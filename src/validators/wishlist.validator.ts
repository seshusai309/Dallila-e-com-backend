import { z } from 'zod';

// Add to Wishlist validation schema
export const AddToWishlistSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

// Export types
export type AddToWishlistInput = z.infer<typeof AddToWishlistSchema>;
