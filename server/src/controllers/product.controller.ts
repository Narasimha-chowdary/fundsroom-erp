import { Request, Response, NextFunction } from 'express';
import { productService } from '../services/product.service';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
  createMovementSchema,
  movementQuerySchema,
} from '../validators/product.validator';
import { UnauthorizedError } from '../utils/errors';

export class ProductController {
  /**
   * GET /api/v1/products
   */
  async getProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = productQuerySchema.parse(req.query);
      const result = await productService.getProducts(query);

      res.status(200).json({
        success: true,
        data: result.products,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/products/:id
   */
  async getProductById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await productService.getProductById(req.params.id);

      res.status(200).json({
        success: true,
        data: { product },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/products
   */
  async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const input = createProductSchema.parse(req.body);
      const product = await productService.createProduct(input, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: { product },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/products/:id
   */
  async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = updateProductSchema.parse(req.body);
      const product = await productService.updateProduct(req.params.id, input);

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: { product },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/inventory/movements
   */
  async recordMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const input = createMovementSchema.parse(req.body);
      const result = await productService.recordMovement(input, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Stock movement recorded successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/inventory/movements
   */
  async getMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = movementQuerySchema.parse(req.query);
      const result = await productService.getMovements(query);

      res.status(200).json({
        success: true,
        data: result.movements,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const productController = new ProductController();
