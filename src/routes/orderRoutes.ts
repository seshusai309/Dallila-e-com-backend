import { Router } from "express";
import { OrderController } from "../controller/OrderController";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { rateLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import {
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  ShipOrderSchema,
  VerifyDeliveryOtpSchema,
} from "../validators/order.validator";

const router = Router();
const orderController = new OrderController();

/**
 * @access private (authenticated users)
 * @route POST /
 * @desc Create new order from cart
 */
router.post(
  "/",
  authenticateToken,
  rateLimiter({ max: 50 }),
  validate(CreateOrderSchema),
  orderController.createOrder.bind(orderController),
);

/**
 * @access private (authenticated users)
 * @route POST /:orderId/regenerate-payment
 * @desc Regenerate payment URL for existing order
 */
router.post(
  "/:orderId/regenerate-payment",
  authenticateToken,
  rateLimiter({ max: 50 }),
  orderController.regeneratePaymentUrl.bind(orderController),
);

/**
 * @access private (authenticated users)
 * @route GET /
 * @desc Get user's orders
 */
router.get(
  "/",
  authenticateToken,
  rateLimiter({ max: 50 }),
  orderController.getUserOrders.bind(orderController),
);

/**
 * @access private (authenticated users)
 * @route GET /stats
 * @desc Get user's order statistics
 */
router.get(
  "/stats",
  authenticateToken,
  rateLimiter({ max: 50 }),
  orderController.getOrderStats.bind(orderController),
);

/**
 * @access private (authenticated users)
 * @route GET /order/:orderNumber
 * @desc Get order by order number
 */
router.get(
  "/order/:orderNumber",
  authenticateToken,
  rateLimiter({ max: 50 }),
  orderController.getOrderByOrderNumber.bind(orderController),
);

/**
 * @access private (authenticated users)
 * @route GET /:orderId
 * @desc Get order by ID
 */
router.get(
  "/:orderId",
  authenticateToken,
  rateLimiter({ max: 50 }),
  orderController.getOrderById.bind(orderController),
);

/**
 * @access private (authenticated users)
 * @route DELETE /:orderId/cancel
 * @desc Cancel an order
 */
router.delete(
  "/:orderId/cancel",
  authenticateToken,
  rateLimiter({ max: 50 }),
  orderController.cancelOrder.bind(orderController),
);

/**
 * @access private (authenticated users)
 * @route GET /payments/history
 * @desc Get user's payment history
 */
router.get(
  "/payments/history",
  authenticateToken,
  rateLimiter({ max: 50 }),
  orderController.getPaymentHistory.bind(orderController),
);

/**
 * @access private (admin only)
 * @route GET /admin/all
 * @desc Get all orders (admin only)
 */
router.get(
  "/admin/all",
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 50 }),
  orderController.getAllOrders.bind(orderController),
);

/**
 * @access private (admin only)
 * @route PUT /admin/:orderId/status
 * @desc Update order status (admin only)
 */
router.put(
  "/admin/:orderId/status",
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 50 }),
  validate(UpdateOrderStatusSchema),
  orderController.updateOrderStatus.bind(orderController),
);

/**
 * @access private (authenticated users)
 * @route PUT /admin/:orderId/ship
 * @desc Ship order with OTP (admin only)
 */
router.put(
  "/admin/:orderId/ship",
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 50 }),
  orderController.shipOrderWithOTP.bind(orderController),
);

/**
 * @access private (authenticated users)
 * @route POST /:orderId/verify-delivery
 * @desc Verify delivery OTP and mark order as delivered
 */
router.post(
  "/:orderId/verify-delivery",
  authenticateToken,
  rateLimiter({ max: 50 }),
  validate(VerifyDeliveryOtpSchema),
  orderController.verifyDeliveryOTP.bind(orderController),
);

export default router;
