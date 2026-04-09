import { z } from 'zod';

// Add to Cart validation schema
export const AddToCartSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().min(1, 'Variant ID is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1').default(1),
});

// Update Cart Item validation schema
export const UpdateCartItemSchema = z.object({
  quantity: z.number().min(1, 'Quantity must be at least 1'),
});

// Export types
export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
