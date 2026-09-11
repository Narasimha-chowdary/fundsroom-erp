import { Prisma, ChallanStatus, MovementType } from '@prisma/client';
import prisma from '../utils/prisma';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import {
  CreateChallanInput,
  UpdateChallanInput,
  ChallanQueryInput,
} from '../validators/challan.validator';

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
};

export class ChallanService {
  /**
   * Deterministically generate a sequential Challan number e.g. CH-202609-0001
   */
  private async generateChallanNumber(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `CH-${year}${month}-`;

    const lastChallan = await tx.salesChallan.findFirst({
      where: { challanNumber: { startsWith: prefix } },
      orderBy: { challanNumber: 'desc' },
      select: { challanNumber: true },
    });

    let nextSequence = 1;
    if (lastChallan) {
      const parts = lastChallan.challanNumber.split('-');
      if (parts.length >= 3) {
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          nextSequence = lastNum + 1;
        }
      }
    }

    return `${prefix}${String(nextSequence).padStart(4, '0')}`;
  }

  /**
   * List challans with search, customer filter, status filter, and pagination
   */
  async getChallans(query: ChallanQueryInput) {
    const { page, limit, status, customerId, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.SalesChallanWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search && search.trim() !== '') {
      const trimmed = search.trim();
      where.OR = [
        { challanNumber: { contains: trimmed, mode: 'insensitive' } },
        { customer: { name: { contains: trimmed, mode: 'insensitive' } } },
        { customer: { businessName: { contains: trimmed, mode: 'insensitive' } } },
      ];
    }

    const [total, rawChallans] = await Promise.all([
      prisma.salesChallan.count({ where }),
      prisma.salesChallan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              businessName: true,
              mobileNumber: true,
            },
          },
          createdBy: { select: safeUserSelect },
          confirmedBy: { select: safeUserSelect },
          items: {
            select: {
              quantity: true,
              lineTotal: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    // Attach total quantity and items count
    const challans = rawChallans.map((ch) => {
      const totalQuantity = ch.items.reduce((sum, item) => sum + item.quantity, 0);
      const itemsCount = ch.items.length;
      const { items, ...rest } = ch;
      return {
        ...rest,
        itemsCount,
        totalQuantity,
      };
    });

    return {
      challans,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Get single challan by ID with full customer, snapshot items, and audit data
   */
  async getChallanById(id: string) {
    const challan = await prisma.salesChallan.findUnique({
      where: { id },
      include: {
        customer: true,
        createdBy: { select: safeUserSelect },
        confirmedBy: { select: safeUserSelect },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                currentStock: true,
              },
            },
          },
        },
      },
    });

    if (!challan) {
      throw new NotFoundError(`Sales challan with ID '${id}' not found`);
    }

    const totalQuantity = challan.items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      ...challan,
      totalQuantity,
    };
  }

  /**
   * Create a new DRAFT Sales Challan with immutable product snapshot line items
   */
  async createChallan(input: CreateChallanInput, userId: string) {
    const { customerId, items, notes } = input;

    const challan = await prisma.$transaction(async (tx) => {
      // 1. Verify customer exists
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer) {
        throw new NotFoundError(`Customer with ID '${customerId}' not found`);
      }

      // 2. Aggregate quantities for duplicate product IDs in same payload
      const itemMap = new Map<string, number>();
      for (const item of items) {
        itemMap.set(item.productId, (itemMap.get(item.productId) || 0) + item.quantity);
      }

      const productIds = Array.from(itemMap.keys());

      // 3. Fetch products and snapshot their state
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      if (products.length !== productIds.length) {
        const foundIds = new Set(products.map((p) => p.id));
        const missingIds = productIds.filter((id) => !foundIds.has(id));
        throw new NotFoundError(`Product(s) with ID(s) [${missingIds.join(', ')}] not found`);
      }

      let totalAmount = new Prisma.Decimal(0);

      const challanItemsData = products.map((product) => {
        const quantity = itemMap.get(product.id)!;
        const lineTotal = product.unitPrice.mul(quantity);
        totalAmount = totalAmount.add(lineTotal);

        return {
          productId: product.id,
          productNameSnapshot: product.name,
          skuSnapshot: product.sku,
          unitPriceSnapshot: product.unitPrice,
          quantity,
          lineTotal,
        };
      });

      // 4. Generate unique sequential challan number
      const challanNumber = await this.generateChallanNumber(tx);

      // 5. Create DRAFT challan (stock remains unchanged!)
      const created = await tx.salesChallan.create({
        data: {
          challanNumber,
          customerId,
          status: ChallanStatus.DRAFT,
          totalAmount,
          notes: notes || null,
          createdById: userId,
          items: {
            create: challanItemsData,
          },
        },
      });

      return created;
    });

    return this.getChallanById(challan.id);
  }

  /**
   * Edit a DRAFT Challan (Confirmed or Cancelled challans cannot be edited)
   */
  async updateChallan(id: string, input: UpdateChallanInput) {
    const challan = await prisma.salesChallan.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!challan) {
      throw new NotFoundError(`Sales challan with ID '${id}' not found`);
    }

    if (challan.status !== ChallanStatus.DRAFT) {
      throw new BadRequestError(
        `Only DRAFT challans can be edited. Challan is currently ${challan.status}.`
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      let customerId = challan.customerId;
      if (input.customerId && input.customerId !== challan.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
        if (!customer) {
          throw new NotFoundError(`Customer with ID '${input.customerId}' not found`);
        }
        customerId = input.customerId;
      }

      let totalAmount = challan.totalAmount;

      // If items are provided, replace them with fresh snapshots
      if (input.items && input.items.length > 0) {
        // Delete old items
        await tx.challanItem.deleteMany({ where: { challanId: id } });

        const itemMap = new Map<string, number>();
        for (const item of input.items) {
          itemMap.set(item.productId, (itemMap.get(item.productId) || 0) + item.quantity);
        }

        const productIds = Array.from(itemMap.keys());
        const products = await tx.product.findMany({ where: { id: { in: productIds } } });

        if (products.length !== productIds.length) {
          const foundIds = new Set(products.map((p) => p.id));
          const missing = productIds.filter((pid) => !foundIds.has(pid));
          throw new NotFoundError(`Product(s) with ID(s) [${missing.join(', ')}] not found`);
        }

        totalAmount = new Prisma.Decimal(0);
        const newItems = products.map((product) => {
          const quantity = itemMap.get(product.id)!;
          const lineTotal = product.unitPrice.mul(quantity);
          totalAmount = totalAmount.add(lineTotal);

          return {
            challanId: id,
            productId: product.id,
            productNameSnapshot: product.name,
            skuSnapshot: product.sku,
            unitPriceSnapshot: product.unitPrice,
            quantity,
            lineTotal,
          };
        });

        await tx.challanItem.createMany({ data: newItems });
      }

      const result = await tx.salesChallan.update({
        where: { id },
        data: {
          customerId,
          totalAmount,
          ...(input.notes !== undefined && { notes: input.notes }),
        },
      });

      return result;
    });

    return this.getChallanById(updated.id);
  }

  /**
   * Confirm a DRAFT Challan: Atomically deducts stock & logs OUT movement for each item.
   * If any product has insufficient stock, the entire operation is rolled back and HTTP 409 is returned.
   */
  async confirmChallan(id: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch Challan & Items
      const challan = await tx.salesChallan.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!challan) {
        throw new NotFoundError(`Sales challan with ID '${id}' not found`);
      }

      if (challan.status === ChallanStatus.CONFIRMED) {
        throw new BadRequestError('Challan is already confirmed');
      }

      if (challan.status === ChallanStatus.CANCELLED) {
        throw new BadRequestError('Cannot confirm a cancelled challan');
      }

      // 2. Strict Pre-flight Check: Verify sufficient stock for ALL items
      for (const item of challan.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new NotFoundError(
            `Product '${item.productNameSnapshot}' (SKU: ${item.skuSnapshot}) not found in inventory`
          );
        }

        if (product.currentStock < item.quantity) {
          throw new ConflictError(
            `Insufficient stock for SKU '${product.sku}' (${product.name}). Requested: ${item.quantity}, Available: ${product.currentStock}`
          );
        }
      }

      // 3. Atomically decrement stock & record OUT StockMovement for each line item
      for (const item of challan.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            movementType: MovementType.OUT,
            quantity: item.quantity,
            reason: `CHALLAN_DISPATCH - Challan #${challan.challanNumber}`,
            referenceId: challan.id,
            createdById: userId,
          },
        });
      }

      // 4. Mark Challan as CONFIRMED
      const confirmedChallan = await tx.salesChallan.update({
        where: { id: challan.id },
        data: {
          status: ChallanStatus.CONFIRMED,
          confirmedById: userId,
          confirmedAt: new Date(),
        },
        include: {
          customer: true,
          createdBy: { select: safeUserSelect },
          confirmedBy: { select: safeUserSelect },
          items: true,
        },
      });

      const totalQuantity = confirmedChallan.items.reduce((sum, item) => sum + item.quantity, 0);

      return {
        ...confirmedChallan,
        totalQuantity,
      };
    });
  }

  /**
   * Cancel an existing non-cancelled challan
   */
  async cancelChallan(id: string, userId: string) {
    const challan = await prisma.salesChallan.findUnique({ where: { id } });
    if (!challan) {
      throw new NotFoundError(`Sales challan with ID '${id}' not found`);
    }

    if (challan.status === ChallanStatus.CANCELLED) {
      throw new BadRequestError('Challan is already cancelled');
    }

    const cancelled = await prisma.salesChallan.update({
      where: { id },
      data: {
        status: ChallanStatus.CANCELLED,
        cancelledById: userId,
        cancelledAt: new Date(),
      },
      include: {
        customer: true,
        createdBy: { select: safeUserSelect },
        confirmedBy: { select: safeUserSelect },
        items: true,
      },
    });

    const totalQuantity = cancelled.items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      ...cancelled,
      totalQuantity,
    };
  }
}

export const challanService = new ChallanService();
