import { Request, Response, NextFunction } from 'express';
import { challanService } from '../services/challan.service';
import {
  createChallanSchema,
  updateChallanSchema,
  challanQuerySchema,
} from '../validators/challan.validator';
import { UnauthorizedError } from '../utils/errors';

export class ChallanController {
  /**
   * GET /api/v1/challans
   */
  async getChallans(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = challanQuerySchema.parse(req.query);
      const result = await challanService.getChallans(query);

      res.status(200).json({
        success: true,
        data: result.challans,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/challans/:id
   */
  async getChallanById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const challan = await challanService.getChallanById(req.params.id);

      res.status(200).json({
        success: true,
        data: { challan },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/challans
   */
  async createChallan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const input = createChallanSchema.parse(req.body);
      const challan = await challanService.createChallan(input, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Sales challan created successfully',
        data: { challan },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/challans/:id
   */
  async updateChallan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateChallanSchema.parse(req.body);
      const challan = await challanService.updateChallan(req.params.id, input);

      res.status(200).json({
        success: true,
        message: 'Sales challan updated successfully',
        data: { challan },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/challans/:id/confirm
   */
  async confirmChallan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const challan = await challanService.confirmChallan(req.params.id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Sales challan confirmed successfully and stock deducted',
        data: { challan },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/challans/:id/cancel
   */
  async cancelChallan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const challan = await challanService.cancelChallan(req.params.id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Sales challan cancelled',
        data: { challan },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const challanController = new ChallanController();
