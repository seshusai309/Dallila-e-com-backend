import { Request, Response, NextFunction } from 'express';
import { OrderService } from '../services/order.service';
import { logger } from '../utils/logger';
import { plainToInstance } from 'class-transformer';
import { OrderResponseDto, OrderStatsDto, PaymentHistoryDto } from '../dtos/order.dto';
import { createPaginatedResponse, parsePaginationParams } from '../utils/pagination';
import { OrderNotFoundError, AddressNotFoundError, AddressNotBelongToUserError, OrderCannotBeCancelledError, InvalidOrderStatusError, OrderAlreadyPaidError, PaymentInProgressError, InsufficientStockError } from '../utils/errors/order.errors';
import { CartNotFoundError } from '../utils/errors/cart.errors';

export class OrderController {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  // Create order from cart
  async createOrder(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { addressId, paymentMethod, successUrl, cancelUrl } = req.body;

      const result = await this.orderService.createOrder({
        userId,
        addressId,
        paymentMethod,
        successUrl,
        cancelUrl
      });

      logger.success(userId, 'createOrder', `Created order ${result.order.orderNumber}`);

      const orderDto = plainToInstance(OrderResponseDto, result.order.toObject(), { excludeExtraneousValues: true });

      const responseData: any = {
        success: true,
        code: 'ORDER_CREATED',
        message: 'Order created successfully',
        data: orderDto
      };

      if (result.checkoutSession && paymentMethod === 'ONLINE') {
        responseData.checkoutSession = result.checkoutSession;
      }

      res.status(201).json(responseData);
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'createOrder', `Failed to create order: ${error.message}`);

      if (error instanceof CartNotFoundError) {
        res.status(400).json({
          success: false,
          error: { code: 'CART_EMPTY', message: error.message }
        });
        return;
      }

      if (error instanceof AddressNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: error.message }
        });
        return;
      }

      if (error instanceof AddressNotBelongToUserError) {
        res.status(403).json({
          success: false,
          error: { code: 'ADDRESS_NOT_BELONG_TO_USER', message: error.message }
        });
        return;
      }

      if (error instanceof InsufficientStockError) {
        res.status(409).json({
          success: false,
          error: { code: 'INSUFFICIENT_STOCK', message: error.message }
        });
        return;
      }

      // No shipping address, product not found, or other known domain errors
      const knownMessages = [
        'No shipping address available',
        'not found',
        'User not found',
      ];
      if (knownMessages.some((m) => error.message?.includes(m))) {
        res.status(400).json({
          success: false,
          error: { code: 'ORDER_ERROR', message: error.message }
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: { code: 'ORDER_ERROR', message: 'Failed to create order. Please try again.' }
      });
    }
  }

  // Regenerate payment URL for existing order
  async regeneratePaymentUrl(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      const { orderId } = req.params;
      const { successUrl, cancelUrl } = req.body;
      const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
        return;
      }

      if (!orderIdStr) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Order ID is required'
          }
        });
        return;
      }

      const result = await this.orderService.regeneratePaymentUrl(
        orderIdStr, 
        userId, 
        successUrl, 
        cancelUrl
      );

      logger.success(userId, 'regeneratePaymentUrl', `Regenerated payment URL for order ${orderIdStr}`);

      res.status(200).json({
        success: true,
        code: 'PAYMENT_URL_REGENERATED',
        message: 'Payment URL regenerated successfully',
        data: result.checkoutSession
      });
    } catch (error: any) {
      if (error instanceof OrderAlreadyPaidError) {
        res.status(200).json({
          success: true,
          code: 'ORDER_ALREADY_PAID',
          message: 'Payment already completed.',
          data: { orderId: error.orderId },
        });
        return;
      }
      if (error instanceof PaymentInProgressError) {
        res.status(409).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }
      if (error instanceof OrderNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Order not found' },
        });
        return;
      }
      logger.error(req.user?._id?.toString() || 'anonymous', 'regeneratePaymentUrl', `Failed to regenerate payment URL: ${error.message}`);
      res.status(400).json({
        success: false,
        error: {
          code: 'PAYMENT_URL_ERROR',
          message: error.message || 'Failed to regenerate payment URL. Please try again.'
        }
      });
    }
  }

  // Get user's orders
  async getUserOrders(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const { page, limit } = parsePaginationParams(req.query as any, 10, 50);

      const result = await this.orderService.getUserOrders(userId, page, limit);
      
      const ordersDto = result.orders.map(order => plainToInstance(OrderResponseDto, order.toObject(), { excludeExtraneousValues: true }));

      logger.success(userId, 'getUserOrders', `Retrieved ${result.orders.length} orders`);

      const paginatedResponse = createPaginatedResponse(ordersDto, result.total, page, limit);

      res.status(200).json({
        success: true,
        code: 'ORDERS_RETRIEVED',
        message: 'Orders retrieved successfully',
        ...paginatedResponse
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getUserOrders', `Failed to get user orders: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'ORDERS_ERROR',
          message: 'Failed to retrieve orders. Please try again.'
        }
      });
    }
  }

  // Get order by order number
  async getOrderByOrderNumber(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      const { orderNumber } = req.params;
      const orderNumberStr = Array.isArray(orderNumber) ? orderNumber[0] : orderNumber;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User authentication required'
        });
        return;
      }

      if (!orderNumberStr) {
        res.status(400).json({
          success: false,
          message: 'Order number is required'
        });
        return;
      }

      const order = await this.orderService.getOrderByOrderNumber(orderNumberStr, userId);

      logger.success(userId, 'getOrderByOrderNumber', `Retrieved order ${orderNumberStr}`);

      res.status(200).json({
        success: true,
        data: order,
        message: 'Order retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getOrderByOrderNumber', `Failed to get order: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to get order'
      });
    }
  }

  // Get order by ID
  async getOrderById(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      const { orderId } = req.params;
      const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
        return;
      }

      if (!orderIdStr) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Order ID is required'
          }
        });
        return;
      }

      const order = await this.orderService.getOrderById(orderIdStr, userId);

      logger.success(userId, 'getOrderById', `Retrieved order ${orderIdStr}`);

      const orderDto = plainToInstance(OrderResponseDto, order.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'ORDER_RETRIEVED',
        message: 'Order retrieved successfully',
        data: orderDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getOrderById', `Failed to get order: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'ORDER_ERROR',
          message: 'Failed to retrieve order. Please try again.'
        }
      });
    }
  }

  // Cancel order
  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      const { orderId } = req.params;
      const { reason } = req.body;
      const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
        return;
      }

      if (!orderIdStr) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Order ID is required'
          }
        });
        return;
      }

      if (!reason || !reason.trim()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'REASON_REQUIRED',
            message: 'A cancellation reason is required'
          }
        });
        return;
      }

      const cancelledOrder = await this.orderService.cancelOrder(orderIdStr, userId, reason.trim());

      logger.success(userId, 'cancelOrder', `Cancelled order ${orderIdStr}`);

      const orderDto = plainToInstance(OrderResponseDto, cancelledOrder?.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'ORDER_CANCELLED',
        message: 'Order cancelled successfully',
        data: orderDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'cancelOrder', `Failed to cancel order: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'CANCEL_ORDER_ERROR',
          message: 'Failed to cancel order. Please try again.'
        }
      });
    }
  }

  // Get order statistics
  async getOrderStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
        return;
      }

      const stats = await this.orderService.getOrderStats(userId);

      logger.success(userId, 'getOrderStats', `Retrieved order statistics`);

      const statsDto = plainToInstance(OrderStatsDto, stats, { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'ORDER_STATS_RETRIEVED',
        message: 'Order statistics retrieved successfully',
        data: statsDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getOrderStats', `Failed to get order stats: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'ORDER_STATS_ERROR',
          message: 'Failed to retrieve order statistics. Please try again.'
        }
      });
    }
  }

  // Admin: Get all orders
  async getAllOrders(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit } = parsePaginationParams(req.query as any, 20, 100);
      const status = req.query.status as any;

      const result = await this.orderService.getAllOrders(page, limit, status);
      
      const ordersDto = result.orders.map(order => plainToInstance(OrderResponseDto, order.toObject(), { excludeExtraneousValues: true }));

      logger.success(req.user?._id?.toString() || 'admin', 'getAllOrders', `Retrieved ${result.orders.length} orders`);

      const paginatedResponse = createPaginatedResponse(ordersDto, result.total, page, limit);

      res.status(200).json({
        success: true,
        code: 'ORDERS_RETRIEVED',
        message: 'All orders retrieved successfully',
        ...paginatedResponse
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'admin', 'getAllOrders', `Failed to get all orders: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'ORDERS_ERROR',
          message: 'Failed to retrieve orders. Please try again.'
        }
      });
    }
  }

  // Get payment history for user
  async getPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const result = await this.orderService.getPaymentHistory(userId, page, limit);
      
      logger.success(userId, 'getPaymentHistory', `Retrieved ${result.payments.length} payment records`);

      res.status(200).json({
        success: true,
        data: result.payments,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(result.total / limit),
          totalRecords: result.total,
          recordsPerPage: limit,
          hasNextPage: page < Math.ceil(result.total / limit),
          hasPrevPage: page > 1,
        },
        message: 'Payment history retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getPaymentHistory', `Failed to get payment history: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to get payment history'
      });
    }
  }

  // Admin: Update order status
  async updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;

      if (!orderIdStr) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      if (!status) {
        res.status(400).json({
          success: false,
          message: 'Order status is required'
        });
        return;
      }

      const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          message: 'Invalid order status'
        });
        return;
      }

      const updatedOrder = await this.orderService.updateOrderStatus(orderIdStr, status);

      logger.success(req.user?._id?.toString() || 'admin', 'updateOrderStatus', `Updated order ${orderIdStr} status to ${status}`);

      res.status(200).json({
        success: true,
        data: updatedOrder,
        message: 'Order status updated successfully'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'admin', 'updateOrderStatus', `Failed to update order status: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update order status'
      });
    }
  }

  // Admin: Update order status to shipped and send OTP
  async shipOrderWithOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      console.log("orderId", orderId);
      const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;

      if (!orderIdStr) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      const result = await this.orderService.shipOrderWithOTP(orderIdStr);

      if (!result.emailSent) {
        logger.error('admin', 'shipOrderWithOTP', `Failed to send delivery OTP email`);
      }

      logger.success(req.user?._id?.toString() || 'admin', 'shipOrderWithOTP', `Order shipped, OTP sent`);

      res.status(200).json({
        success: true,
        data: result.order,
        message: 'Order shipped successfully. Delivery OTP has been sent to the user.'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'admin', 'shipOrderWithOTP', `Failed to ship order: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to ship order'
      });
    }
  }

  // Verify delivery OTP and update status to delivered
  async verifyDeliveryOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.params;
      const { otp } = req.body;
      const orderIdStr = Array.isArray(orderId) ? orderId[0] : orderId;

      if (!orderIdStr) {
        res.status(400).json({
          success: false,
          message: 'Order ID is required'
        });
        return;
      }

      if (!otp) {
        res.status(400).json({
          success: false,
          message: 'OTP is required'
        });
        return;
      }

      const updatedOrder = await this.orderService.verifyDeliveryOTP(orderIdStr, otp);

      logger.success(req.user?._id?.toString() || 'anonymous', 'verifyDeliveryOTP', `Order ${orderIdStr} marked as delivered`);

      res.status(200).json({
        success: true,
        data: updatedOrder,
        message: 'Order delivered successfully! Thank you for confirming.'
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'verifyDeliveryOTP', `Failed to verify delivery OTP: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to verify delivery OTP'
      });
    }
  }
}
