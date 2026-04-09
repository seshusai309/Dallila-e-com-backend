import { Order, OrderModel } from '../models/Order';
import { logger } from '../utils/logger';

export class OrderRepository {
  // Create new order
  async create(orderData: Partial<Order>): Promise<Order> {
    try {
      const order = new OrderModel(orderData);
      return await order.save();
    } catch (error: any) {
      logger.error('OrderRepository', 'create', `Failed to create order: ${error.message}`);
      throw error;
    }
  }

  // Find order by ID
  async findById(id: string): Promise<Order | null> {
    try {
      return await OrderModel.findById(id);
    } catch (error: any) {
      logger.error('OrderRepository', 'findById', `Failed to find order by ID: ${error.message}`);
      throw error;
    }
  }

  // Find order by order number
  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    try {
      return await OrderModel.findOne({ orderNumber, isActive: true });
    } catch (error: any) {
      logger.error('OrderRepository', 'findByOrderNumber', `Failed to find order by order number: ${error.message}`);
      throw error;
    }
  }

  // Find orders by user ID
  async findByUserId(userId: string, limit: number = 10, offset: number = 0): Promise<Order[]> {
    try {
      return await OrderModel.find({ userId, isActive: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset);
    } catch (error: any) {
      logger.error('OrderRepository', 'findByUserId', `Failed to find orders by user ID: ${error.message}`);
      throw error;
    }
  }

  // Update order status
  async updateOrderStatus(orderId: string, status: Order['orderStatus']): Promise<Order | null> {
    try {
      return await OrderModel.findByIdAndUpdate(
        orderId,
        { orderStatus: status },
        { new: true }
      );
    } catch (error: any) {
      logger.error('OrderRepository', 'updateOrderStatus', `Failed to update order status: ${error.message}`);
      throw error;
    }
  }

  // Update payment status
  async updatePaymentStatus(orderId: string, status: Order['paymentStatus'], transactionId?: string): Promise<Order | null> {
    try {
      const updateData: any = { paymentStatus: status };
      if (transactionId) {
        updateData.transactionId = transactionId;
      }
      
      return await OrderModel.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true }
      );
    } catch (error: any) {
      logger.error('OrderRepository', 'updatePaymentStatus', `Failed to update payment status: ${error.message}`);
      throw error;
    }
  }

  // Update session ID and expiration (for Stripe Checkout Sessions)
  async updateSessionId(orderId: string, sessionId: string, sessionExpiresAt?: Date): Promise<Order | null> {
    try {
      const updateData: any = { sessionId };
      if (sessionExpiresAt) {
        updateData.sessionExpiresAt = sessionExpiresAt;
      }
      
      return await OrderModel.findByIdAndUpdate(
        orderId,
        updateData,
        { new: true }
      );
    } catch (error: any) {
      logger.error('OrderRepository', 'updateSessionId', `Failed to update session ID: ${error.message}`);
      throw error;
    }
  }

  // Cancel order
  async cancelOrder(orderId: string): Promise<Order | null> {
    try {
      return await OrderModel.findByIdAndUpdate(
        orderId,
        { orderStatus: 'CANCELLED' },
        { new: true }
      );
    } catch (error: any) {
      logger.error('OrderRepository', 'cancelOrder', `Failed to cancel order: ${error.message}`);
      throw error;
    }
  }

  // Get order statistics for user
  async getOrderStats(userId: string): Promise<{
    totalOrders: number;
    pendingOrders: number;
    confirmedOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    totalSpent: number;
  }> {
    try {
      const stats = await OrderModel.aggregate([
        { $match: { userId, isActive: true } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            pendingOrders: {
              $sum: { $cond: [{ $eq: ['$orderStatus', 'PENDING'] }, 1, 0] }
            },
            confirmedOrders: {
              $sum: { $cond: [{ $eq: ['$orderStatus', 'CONFIRMED'] }, 1, 0] }
            },
            shippedOrders: {
              $sum: { $cond: [{ $eq: ['$orderStatus', 'SHIPPED'] }, 1, 0] }
            },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ['$orderStatus', 'DELIVERED'] }, 1, 0] }
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$orderStatus', 'CANCELLED'] }, 1, 0] }
            },
            totalSpent: { $sum: '$totalAmount' }
          }
        }
      ]);

      return stats[0] || {
        totalOrders: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        shippedOrders: 0,
        deliveredOrders: 0,
        cancelledOrders: 0,
        totalSpent: 0
      };
    } catch (error: any) {
      logger.error('OrderRepository', 'getOrderStats', `Failed to get order stats: ${error.message}`);
      throw error;
    }
  }

  // Get all orders (admin only)
  async getAllOrders(limit: number = 20, offset: number = 0, status?: Order['orderStatus']): Promise<Order[]> {
    try {
      const query: any = { isActive: true };
      if (status) {
        query.orderStatus = status;
      }
      
      return await OrderModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .populate('userId', 'username email');
    } catch (error: any) {
      logger.error('OrderRepository', 'getAllOrders', `Failed to get all orders: ${error.message}`);
      throw error;
    }
  }

  // Get order by session ID (for Stripe webhooks)
  async findBySessionId(sessionId: string): Promise<Order | null> {
    try {
      return await OrderModel.findOne({ sessionId, isActive: true });
    } catch (error: any) {
      logger.error('OrderRepository', 'findBySessionId', `Failed to find order by session ID: ${error.message}`);
      throw error;
    }
  }

  // Deactivate order (soft delete)
  async deactivateOrder(orderId: string): Promise<boolean> {
    try {
      const result = await OrderModel.findByIdAndUpdate(
        orderId,
        { isActive: false },
        { new: true }
      );
      return result !== null;
    } catch (error: any) {
      logger.error('OrderRepository', 'deactivateOrder', `Failed to deactivate order: ${error.message}`);
      throw error;
    }
  }

  // Update order status to shipped and set delivery OTP
  async updateToShippedWithOTP(orderId: string, otp: string, otpExpires: Date): Promise<Order | null> {
    try {
      return await OrderModel.findByIdAndUpdate(
        orderId,
        { 
          orderStatus: 'SHIPPED',
          deliveryOtp: otp,
          deliveryOtpExpires: otpExpires
        },
        { new: true }
      );
    } catch (error: any) {
      logger.error('OrderRepository', 'updateToShippedWithOTP', `Failed to update order to shipped with OTP: ${error.message}`);
      throw error;
    }
  }

  // Verify delivery OTP and update status to delivered
  async verifyDeliveryOTP(orderId: string, otp: string): Promise<Order | null> {
    try {
      const order = await OrderModel.findById(orderId);
      if (!order) {
        return null;
      }

      // Check if OTP matches and is not expired
      if (!order.deliveryOtp || order.deliveryOtp !== otp) {
        return null;
      }

      if (!order.deliveryOtpExpires || order.deliveryOtpExpires < new Date()) {
        return null;
      }

      // Update status to delivered and clear OTP
      return await OrderModel.findByIdAndUpdate(
        orderId,
        { 
          orderStatus: 'DELIVERED',
          deliveryOtp: undefined,
          deliveryOtpExpires: undefined
        },
        { new: true }
      );
    } catch (error: any) {
      logger.error('OrderRepository', 'verifyDeliveryOTP', `Failed to verify delivery OTP: ${error.message}`);
      throw error;
    }
  }
}
