import { z } from 'zod';

// Create Review validation schema
export const CreateReviewSchema = z.object({
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  comment: z.string().min(1, 'Comment is required').max(1000, 'Comment must be at most 1000 characters'),
});

// Update Review validation schema (partial update)
export const UpdateReviewSchema = z.object({
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5').optional(),
  comment: z.string().min(1, 'Comment is required').max(1000, 'Comment must be at most 1000 characters').optional(),
});

// Export types
export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;
export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;
