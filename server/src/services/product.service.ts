import { Prisma, MovementType } from '@prisma/client';
import prisma from '../utils/prisma';
import { NotFoundError, ConflictError } from '../utils/errors';
import {
  CreateProductInput,
  UpdateProductInput,
  ProductQueryInput,
  CreateMovementInput,
  MovementQueryInput,
} from '../validators/product.validator';

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
};

export class ProductService {
  /**
   * List products with search, category filtering, stock alerts, and pagination
   */
  async getProducts(query: ProductQueryInput) {
    const { page, limit, search, category, lowStock, outOfStock } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (search && search.trim() !== '') {
      const trimmed = search.trim();
      where.OR = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { sku: { contains: trimmed, mode: 'insensitive' } },
      ];
    }

    if (outOfStock) {
      where.currentStock = 0;
    } else if (lowStock) {
      // Find IDs of products where currentStock <= minStockAlert
      const lowStockProducts = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product" WHERE "currentStock" <= "minStockAlert" AND "isActive" = true
      `;
      const ids = lowStockProducts.map((p) => p.id);
      where.id = { in: ids };
    }

    const [total, rawProducts] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    // Attach computed stock status indicators
    const products = rawProducts.map((p) => ({
      ...p,
      isLowStock: p.currentStock <= p.minStockAlert && p.currentStock > 0,
      isOutOfStock: p.currentStock === 0,
    }));

    return {
      products,
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
   * Get single product by ID with recent stock movement history
   */
  async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            createdBy: { select: safeUserSelect },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError(`Product with ID '${id}' not found`);
    }

    return {
      ...product,
      isLowStock: product.currentStock <= product.minStockAlert && product.currentStock > 0,
      isOutOfStock: product.currentStock === 0,
    };
  }

  /**
   * Create new product with unique SKU and optional initial stock movement
   */
  async createProduct(input: CreateProductInput, userId: string) {
    const existing = await prisma.product.findUnique({
      where: { sku: input.sku },
    });

    if (existing) {
      throw new ConflictError(`Product with SKU '${input.sku}' already exists`);
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: input.name,
          sku: input.sku,
          category: input.category,
          unitPrice: new Prisma.Decimal(input.unitPrice),
          currentStock: input.initialStock,
          minStockAlert: input.minStockAlert,
          location: input.location,
        },
      });

      if (input.initialStock > 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            movementType: MovementType.IN,
            quantity: input.initialStock,
            reason: 'INITIAL_PURCHASE_RECEIPT',
            createdById: userId,
          },
        });
      }

      return created;
    });

    return this.getProductById(product.id);
  }

  /**
   * Update product master details
   */
  async updateProduct(id: string, input: UpdateProductInput) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Product with ID '${id}' not found`);
    }

    if (input.sku && input.sku !== existing.sku) {
      const duplicateSku = await prisma.product.findUnique({
        where: { sku: input.sku },
      });
      if (duplicateSku) {
        throw new ConflictError(`Product with SKU '${input.sku}' already exists`);
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.sku !== undefined && { sku: input.sku }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.unitPrice !== undefined && { unitPrice: new Prisma.Decimal(input.unitPrice) }),
        ...(input.minStockAlert !== undefined && { minStockAlert: input.minStockAlert }),
        ...(input.location !== undefined && { location: input.location }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    return updated;
  }

  /**
   * Atomically record stock movement and update product stock
   */
  async recordMovement(input: CreateMovementInput, userId: string) {
    const { productId, movementType, quantity, reason, remarks } = input;

    const formattedReason = remarks ? `${reason} - ${remarks}` : reason;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current product state inside the transaction
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundError(`Product with ID '${productId}' not found`);
      }

      // 2. Validate stock sufficiency for OUT movements
      if (movementType === MovementType.OUT) {
        if (product.currentStock < quantity) {
          throw new ConflictError(
            `Insufficient stock for SKU '${product.sku}' (${product.name}). Requested: ${quantity}, Available: ${product.currentStock}`
          );
        }
      }

      // 3. Calculate new stock level (strictly non-negative)
      const newStock =
        movementType === MovementType.IN
          ? product.currentStock + quantity
          : product.currentStock - quantity;

      // 4. Update product currentStock
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { currentStock: newStock },
      });

      // 5. Create immutable audit stock movement entry
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          movementType,
          quantity,
          reason: formattedReason,
          createdById: userId,
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: true,
            },
          },
          createdBy: { select: safeUserSelect },
        },
      });

      return {
        movement,
        currentStock: updatedProduct.currentStock,
      };
    });

    return result;
  }

  /**
   * Audit log of all stock movements with filtering and pagination
   */
  async getMovements(query: MovementQueryInput) {
    const { page, limit, productId, movementType } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.StockMovementWhereInput = {};

    if (productId) {
      where.productId = productId;
    }

    if (movementType) {
      where.movementType = movementType;
    }

    const [total, movements] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              category: true,
            },
          },
          createdBy: { select: safeUserSelect },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      movements,
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
}

export const productService = new ProductService();
