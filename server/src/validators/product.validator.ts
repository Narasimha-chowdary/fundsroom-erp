import { z } from 'zod';
import { MovementType } from '@prisma/client';

export const createProductSchema = z.object({
  name: z
    .string({ required_error: 'Product name is required' })
    .trim()
    .min(1, 'Product name cannot be empty')
    .max(200, 'Product name cannot exceed 200 characters'),
  sku: z
    .string({ required_error: 'SKU is required' })
    .trim()
    .min(1, 'SKU cannot be empty')
    .max(50, 'SKU cannot exceed 50 characters')
    .transform((val) => val.toUpperCase()),
  category: z
    .string({ required_error: 'Category is required' })
    .trim()
    .min(1, 'Category cannot be empty')
    .max(100, 'Category cannot exceed 100 characters'),
  unitPrice: z
    .number({ required_error: 'Unit price is required' })
    .nonnegative('Unit price cannot be negative'),
  initialStock: z
    .number()
    .int('Initial stock must be an integer')
    .nonnegative('Initial stock cannot be negative')
    .default(0),
  minStockAlert: z
    .number()
    .int('Minimum stock alert must be an integer')
    .nonnegative('Minimum stock alert cannot be negative')
    .default(10),
  location: z
    .string({ required_error: 'Location/warehouse is required' })
    .trim()
    .min(1, 'Location cannot be empty')
    .max(100, 'Location cannot exceed 100 characters'),
});

export const updateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Product name cannot be empty')
    .max(200)
    .optional(),
  sku: z
    .string()
    .trim()
    .min(1, 'SKU cannot be empty')
    .max(50)
    .transform((val) => val.toUpperCase())
    .optional(),
  category: z
    .string()
    .trim()
    .min(1, 'Category cannot be empty')
    .max(100)
    .optional(),
  unitPrice: z
    .number()
    .nonnegative('Unit price cannot be negative')
    .optional(),
  minStockAlert: z
    .number()
    .int('Minimum stock alert must be an integer')
    .nonnegative('Minimum stock alert cannot be negative')
    .optional(),
  location: z
    .string()
    .trim()
    .min(1, 'Location cannot be empty')
    .max(100)
    .optional(),
  isActive: z.boolean().optional(),
});

export const productQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 10)) : 10)),
  search: z
    .string()
    .trim()
    .optional(),
  category: z
    .string()
    .trim()
    .optional(),
  lowStock: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  outOfStock: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export const createMovementSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .uuid('Invalid product ID format'),
  movementType: z.nativeEnum(MovementType, {
    errorMap: () => ({ message: 'Movement type must be IN or OUT' }),
  }),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .positive('Quantity must be strictly greater than 0'),
  reason: z
    .string({ required_error: 'Reason is required' })
    .trim()
    .min(1, 'Reason cannot be empty')
    .max(255, 'Reason cannot exceed 255 characters'),
  remarks: z
    .string()
    .trim()
    .max(500)
    .optional(),
});

export const movementQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 10)) : 10)),
  productId: z
    .string()
    .uuid('Invalid product ID format')
    .optional(),
  movementType: z
    .nativeEnum(MovementType)
    .optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type CreateMovementInput = z.infer<typeof createMovementSchema>;
export type MovementQueryInput = z.infer<typeof movementQuerySchema>;
