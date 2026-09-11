import { z } from 'zod';
import { CustomerStatus, CustomerType } from '@prisma/client';

// GST format: 15 alphanumeric characters (2 state digits, 5 PAN letters, 4 PAN digits, 1 PAN letter, 1 entity digit, 'Z', 1 checksum digit/letter)
const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
const phoneRegex = /^[+]?[0-9]{10,15}$/;

export const createCustomerSchema = z.object({
  name: z
    .string({ required_error: 'Customer name is required' })
    .trim()
    .min(1, 'Customer name cannot be empty')
    .max(100, 'Customer name cannot exceed 100 characters'),
  businessName: z
    .string({ required_error: 'Business name is required' })
    .trim()
    .min(1, 'Business name cannot be empty')
    .max(150, 'Business name cannot exceed 150 characters'),
  mobileNumber: z
    .string({ required_error: 'Mobile number is required' })
    .trim()
    .regex(phoneRegex, 'Please provide a valid mobile number (10 to 15 digits)'),
  address: z
    .string({ required_error: 'Address is required' })
    .trim()
    .min(1, 'Address cannot be empty')
    .max(500, 'Address cannot exceed 500 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstRegex, 'Invalid GST number format (e.g. 22AAAAA0000A1Z5)')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val === '' ? undefined : val)),
  customerType: z
    .nativeEnum(CustomerType, {
      errorMap: () => ({ message: 'Customer type must be RETAIL, WHOLESALE, or DISTRIBUTOR' }),
    })
    .default(CustomerType.RETAIL),
  status: z
    .nativeEnum(CustomerStatus, {
      errorMap: () => ({ message: 'Status must be LEAD, ACTIVE, or INACTIVE' }),
    })
    .default(CustomerStatus.LEAD),
  followUpDate: z
    .string()
    .datetime({ offset: true, message: 'Invalid follow-up date format (ISO datetime required)' })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'))
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
  initialNote: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .optional(),
});

export const updateCustomerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Customer name cannot be empty')
    .max(100)
    .optional(),
  businessName: z
    .string()
    .trim()
    .min(1, 'Business name cannot be empty')
    .max(150)
    .optional(),
  mobileNumber: z
    .string()
    .trim()
    .regex(phoneRegex, 'Please provide a valid mobile number (10 to 15 digits)')
    .optional(),
  address: z
    .string()
    .trim()
    .min(1, 'Address cannot be empty')
    .max(500)
    .optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val)),
  gstNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(gstRegex, 'Invalid GST number format (e.g. 22AAAAA0000A1Z5)')
    .optional()
    .nullable()
    .or(z.literal(''))
    .transform((val) => (val === '' ? null : val)),
  customerType: z
    .nativeEnum(CustomerType, {
      errorMap: () => ({ message: 'Customer type must be RETAIL, WHOLESALE, or DISTRIBUTOR' }),
    })
    .optional(),
  status: z
    .nativeEnum(CustomerStatus, {
      errorMap: () => ({ message: 'Status must be LEAD, ACTIVE, or INACTIVE' }),
    })
    .optional(),
  followUpDate: z
    .string()
    .datetime({ offset: true, message: 'Invalid follow-up date format (ISO datetime required)' })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'))
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
});

export const customerQuerySchema = z.object({
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
  status: z
    .nativeEnum(CustomerStatus)
    .optional(),
  customerType: z
    .nativeEnum(CustomerType)
    .optional(),
});

export const createCustomerNoteSchema = z.object({
  note: z
    .string({ required_error: 'Note content is required' })
    .trim()
    .min(1, 'Note content cannot be empty')
    .max(2000, 'Note cannot exceed 2000 characters'),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;
export type CreateCustomerNoteInput = z.infer<typeof createCustomerNoteSchema>;
