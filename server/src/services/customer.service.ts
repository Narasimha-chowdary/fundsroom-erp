import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { NotFoundError } from '../utils/errors';
import {
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerQueryInput,
} from '../validators/customer.validator';

const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
};

export class CustomerService {
  /**
   * Fetch paginated and filtered list of customers
   */
  async getCustomers(query: CustomerQueryInput) {
    const { page, limit, search, status, customerType } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (customerType) {
      where.customerType = customerType;
    }

    if (search && search.trim() !== '') {
      const trimmedSearch = search.trim();
      where.OR = [
        { name: { contains: trimmedSearch, mode: 'insensitive' } },
        { businessName: { contains: trimmedSearch, mode: 'insensitive' } },
        { mobileNumber: { contains: trimmedSearch } },
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          mobileNumber: true,
          email: true,
          businessName: true,
          gstNumber: true,
          customerType: true,
          address: true,
          status: true,
          followUpDate: true,
          createdAt: true,
          updatedAt: true,
          createdBy: { select: safeUserSelect },
          _count: {
            select: {
              notes: true,
              challans: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      customers,
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
   * Fetch complete customer details including interaction notes and challans
   */
  async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        createdBy: { select: safeUserSelect },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: safeUserSelect },
          },
        },
        challans: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            challanNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundError(`Customer with ID '${id}' not found`);
    }

    return customer;
  }

  /**
   * Create a new customer lead/account with optional initial note
   */
  async createCustomer(data: CreateCustomerInput, createdById: string) {
    const { initialNote, ...customerData } = data;

    const customer = await prisma.$transaction(async (tx) => {
      const createdCustomer = await tx.customer.create({
        data: {
          name: customerData.name,
          businessName: customerData.businessName,
          mobileNumber: customerData.mobileNumber,
          address: customerData.address,
          email: customerData.email,
          gstNumber: customerData.gstNumber,
          customerType: customerData.customerType,
          status: customerData.status,
          followUpDate: customerData.followUpDate,
          createdById,
        },
        include: {
          createdBy: { select: safeUserSelect },
        },
      });

      if (initialNote && initialNote.trim()) {
        await tx.customerNote.create({
          data: {
            customerId: createdCustomer.id,
            note: initialNote.trim(),
            authorId: createdById,
          },
        });
      }

      return createdCustomer;
    });

    return this.getCustomerById(customer.id);
  }

  /**
   * Update existing customer details and follow-up date
   */
  async updateCustomer(id: string, data: UpdateCustomerInput) {
    // Check existence
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Customer with ID '${id}' not found`);
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.businessName !== undefined && { businessName: data.businessName }),
        ...(data.mobileNumber !== undefined && { mobileNumber: data.mobileNumber }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.gstNumber !== undefined && { gstNumber: data.gstNumber }),
        ...(data.customerType !== undefined && { customerType: data.customerType }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.followUpDate !== undefined && { followUpDate: data.followUpDate }),
      },
      include: {
        createdBy: { select: safeUserSelect },
      },
    });

    return updated;
  }

  /**
   * Add a follow-up/interaction note to a customer
   */
  async addCustomerNote(customerId: string, noteText: string, authorId: string) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundError(`Customer with ID '${customerId}' not found`);
    }

    const note = await prisma.customerNote.create({
      data: {
        customerId,
        note: noteText,
        authorId,
      },
      include: {
        author: { select: safeUserSelect },
      },
    });

    return note;
  }
}

export const customerService = new CustomerService();
