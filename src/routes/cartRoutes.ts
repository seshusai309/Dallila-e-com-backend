import { Router } from 'express';
import { CartController } from '../controller/CartController';
import { authenticateToken, requireUser, requireAdmin } from '../middleware/auth';
// import { optionalAuth } from '../middleware/optionalAuth';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { AddToCartSchema, UpdateCartItemSchema } from '../validators/cart.validator';

const router = Router();
const cartController = new CartController();

/**
 * @access public (optional auth for guests)
 * @route GET /
 * @desc Get or create cart for user/guest
 */
router.get(
  '/',
  rateLimiter({ max: 50 }),
  authenticateToken,
  cartController.getCart.bind(cartController)
);

/**
 * @access public (optional auth for guests)
 * @route POST /add
 * @desc Add item to cart
 */
router.post(
  '/add',
  rateLimiter({ max: 20 }),
  authenticateToken,
  validate(AddToCartSchema),
  cartController.addToCart.bind(cartController)
);

/**
 * @access public (optional auth for guests)
 * @route PUT /item/:productId
 * @desc Update cart item quantity for a product
 */
router.put(
  '/item/:productId',
  rateLimiter({ max: 20 }),
  authenticateToken,
  validate(UpdateCartItemSchema),
  cartController.updateCartItemByProduct.bind(cartController)
);

/**
 * @access public (optional auth for guests)
 * @route DELETE /item/:productId
 * @desc Remove item from cart
 */
router.delete(
  '/item/:productId',
  rateLimiter({ max: 20 }),
  authenticateToken,
  cartController.removeFromCart.bind(cartController)
);

/**
 * @access public (optional auth for guests)
 * @route DELETE /clear
 * @desc Clear all items from cart
 */
router.delete(
  '/clear',
  rateLimiter({ max: 10 }),
  authenticateToken,
  cartController.clearCart.bind(cartController)
);

/**
 * @access public (optional auth for guests)
 * @route GET /stats
 * @desc Get cart statistics
 */
router.get(
  '/stats',
  rateLimiter({ max: 30 }),
  authenticateToken,
  cartController.getCartStats.bind(cartController)
);

/**
 * @access public (optional auth for guests)
 * @route POST /validate
 * @desc Validate cart items (check stock availability)
 */
router.post(
  '/validate',
  rateLimiter({ max: 20 }),
  authenticateToken,
  cartController.validateCart.bind(cartController)
);

/**
 * @access private (admin only)
 * @route GET /guest-carts
 * @desc Get all guest carts (admin only)
 */
router.get(
  '/guest-carts',
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 30 }),
  cartController.getAllGuestCarts.bind(cartController)
);

/**
 * @access private (admin only)
 * @route GET /admin/user/:userId
 * @desc Get cart by user ID (admin)
 */
router.get(
  '/admin/user/:userId',
  rateLimiter({ max: 30 }),
  authenticateToken,
  requireAdmin,
  cartController.getCartByUserId.bind(cartController)
);

/**
 * @access private (admin only)
 * @route GET /admin/users
 * @desc Get all users with carts (admin)
 */
router.get(
  '/admin/users',
  rateLimiter({ max: 20 }),
  authenticateToken,
  requireAdmin,
  cartController.getAllUsersWithCarts.bind(cartController)
);

export default router;
