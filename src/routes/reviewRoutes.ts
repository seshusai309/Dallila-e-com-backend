import { Router } from 'express';
import { ReviewController } from '../controller/ReviewController';
import { authenticateToken } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { CreateReviewSchema, UpdateReviewSchema } from '../validators/review.validator';
import { optionalAuth } from '../middleware/optionalAuth';

const router = Router();
const reviewController = new ReviewController();

/**
 * @access private (authenticated users)
 * @route GET /user/reviews
 * @desc Get current user's reviews
 */
router.get(
  '/user/reviews',
  authenticateToken,
  rateLimiter({ max: 20 }),
  reviewController.getUserReviews
);

/**
 * @access public
 * @route POST /:id/helpful
 * @desc Mark a review as helpful
 */
router.post(
  '/:id/helpful',
  rateLimiter({ max: 10 }),
  reviewController.markReviewHelpful
);

/**
 * @access private (review owner or admin)
 * @route PUT /:id
 * @desc Update a review
 */
router.put(
  '/:id',
  authenticateToken,
  rateLimiter({ max: 5 }),
  validate(UpdateReviewSchema),
  reviewController.updateReview
);

/**
 * @access private (review owner or admin)
 * @route DELETE /:id
 * @desc Delete a review
 */
router.delete(
  '/:id',
  authenticateToken,
  rateLimiter({ max: 5 }),
  reviewController.deleteReview
);

/**
 * @access private (authenticated users)
 * @route POST /:productId
 * @desc Create a review for a product
 */
router.post(
  '/:productId',
  authenticateToken,
  rateLimiter({ max: 5 }),
  validate(CreateReviewSchema),
  reviewController.createReview
);

/**
 * @access public
 * @route GET /:productId
 * @desc Get all reviews for a product with pagination
 */
router.get(
  '/:productId',
  optionalAuth,
  rateLimiter({ max: 50 }),
  reviewController.getProductReviews
);

export default router;
