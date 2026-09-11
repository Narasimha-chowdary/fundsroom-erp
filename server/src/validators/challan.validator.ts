import { z } from 'zod';
import { ChallanStatus } from '@prisma/client';

export const challanItemInputSchema = z.object({
  productId: z
    .string({ required_error: 'Product ID is required' })
    .uuid('Invalid product ID format'),
  quantity: z
    .number({ required_error: 'Quantity is required' })
    .int('Quantity must be an integer')
    .positive('Quantity must be strictly greater than 0'),
});

export const createChallanSchema = z.object({
  customerId: z
    .string({ required_error: 'Customer ID is required' })
    .uuid('Invalid customer ID format'),
  items: z
    .array(challanItemInputSchema, { required_error: 'Challan items are required' })
    .min(1, 'At least one product item is required'),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .optional()
    .nullable(),
});

export const updateChallanSchema = z.object({
  customerId: z
    .string()
    .uuid('Invalid customer ID format')
    .optional(),
  items: z
    .array(challanItemInputSchema)
    .min(1, 'At least one product item is required')
    .optional(),
  notes: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable(),
});

export const challanQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? Math.max(1, parseInt(val, 10) || 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Math.min(100, Math.max(1, parseInt(val, 10) || 10)) : 10)),
  status: z
    .nativeEnum(ChallanStatus)
    .optional(),
  customerId: z
    .string()
    .uuid('Invalid customer ID format')
    .optional(),
  search: z
    .string()
    .trim()
    .optional(),
});

export type CreateChallanInput = z.infer<typeof createChallanSchema>;
export type UpdateChallanInput = z.infer<typeof updateChallanSchema>;
export type ChallanQueryInput = z.infer<typeof challanQuerySchema>;
