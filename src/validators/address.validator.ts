import { z } from 'zod';

export const CreateAddressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  isDefault: z.boolean().optional().default(false),
  addressType: z.enum(['home', 'work', 'billing', 'shipping']).optional().default('home'),
});

export const UpdateAddressSchema = z.object({
  street: z.string().min(1, 'Street is required').optional(),
  city: z.string().min(1, 'City is required').optional(),
  state: z.string().min(1, 'State is required').optional(),
  postalCode: z.string().min(1, 'Postal code is required').optional(),
  country: z.string().min(1, 'Country is required').optional(),
  isDefault: z.boolean().optional(),
  addressType: z.enum(['home', 'work', 'billing', 'shipping']).optional(),
});

export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;
