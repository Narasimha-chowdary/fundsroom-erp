import { Request, Response, NextFunction } from 'express';
import { customerService } from '../services/customer.service';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
  createCustomerNoteSchema,
} from '../validators/customer.validator';
import { UnauthorizedError } from '../utils/errors';

export class CustomerController {
  /**
   * GET /api/v1/customers
   */
  async getCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = customerQuerySchema.parse(req.query);
      const result = await customerService.getCustomers(query);

      res.status(200).json({
        success: true,
        data: result.customers,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/:id
   */
  async getCustomerById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customer = await customerService.getCustomerById(req.params.id);

      res.status(200).json({
        success: true,
        data: { customer },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/customers
   */
  async createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const input = createCustomerSchema.parse(req.body);
      const customer = await customerService.createCustomer(input, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: { customer },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/customers/:id
   */
  async updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateCustomerSchema.parse(req.body);
      const customer = await customerService.updateCustomer(req.params.id, input);

      res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        data: { customer },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/customers/:id/notes
   */
  async addCustomerNote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const input = createCustomerNoteSchema.parse(req.body);
      const note = await customerService.addCustomerNote(req.params.id, input.note, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Follow-up note added successfully',
        data: { note },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const customerController = new CustomerController();
