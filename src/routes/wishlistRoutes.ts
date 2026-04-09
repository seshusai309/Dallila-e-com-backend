import { Router } from 'express';
import { WishlistController } from '../controller/WishlistController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { AddToWishlistSchema } from '../validators/wishlist.validator';

const router = Router();
const wishlistController = new WishlistController();

/**
 * @access private
 * @route GET /
 * @desc Get user's wishlist
 */
router.get(
  '/',
  rateLimiter({ max: 100 }),
  authenticateToken,
  wishlistController.getWishlist.bind(wishlistController)
);

/**
 * @access private
 * @route POST /add
 * @desc Add item to wishlist
 */
router.post(
  '/add',
  rateLimiter({ max: 50 }),
  authenticateToken,
  validate(AddToWishlistSchema),
  wishlistController.addToWishlist.bind(wishlistController)
);

/**
 * @access private
 * @route DELETE /item/:productId
 * @desc Remove item from wishlist
 */
router.delete(
  '/item/:productId',
  rateLimiter({ max: 50 }),
  authenticateToken,
  wishlistController.removeFromWishlist.bind(wishlistController)
);

/**
 * @access private
 * @route DELETE /clear
 * @desc Clear entire wishlist
 */
router.delete(
  '/clear',
  rateLimiter({ max: 20 }),
  authenticateToken,
  wishlistController.clearWishlist.bind(wishlistController)
);

/**
 * @access private
 * @route GET /stats
 * @desc Get wishlist statistics
 */
router.get(
  '/stats',
  rateLimiter({ max: 50 }),
  authenticateToken,
  wishlistController.getWishlistStats.bind(wishlistController)
);

/**
 * @access private (admin only)
 * @route GET /admin/user/:userId
 * @desc Get wishlist by user ID (admin)
 */
router.get(
  '/admin/user/:userId',
  rateLimiter({ max: 30 }),
  authenticateToken,
  requireAdmin,
  wishlistController.getWishlistByUserId.bind(wishlistController)
);

/**
 * @access private (admin only)
 * @route GET /admin/user/:userId/stats
 * @desc Get wishlist statistics by user ID (admin)
 */
router.get(
  '/admin/user/:userId/stats',
  rateLimiter({ max: 30 }),
  authenticateToken,
  requireAdmin,
  wishlistController.getWishlistStatsByUserId.bind(wishlistController)
);

/**
 * @access private (admin only)
 * @route GET /admin/users
 * @desc Get all users with wishlists (admin)
 */
router.get(
  '/admin/users',
  rateLimiter({ max: 20 }),
  authenticateToken,
  requireAdmin,
  wishlistController.getAllUsersWithWishlists.bind(wishlistController)
);

export default router;
