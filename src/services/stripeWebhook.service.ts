import { OrderRepository } from '../repository/OrderRepository';
import { StripeService } from '../integrations/StripeService';
import { logger } from '../utils/logger';
import Stripe from 'stripe';
import { OrderModel } from '../models/Order';

export interface WebhookResult {
  processed: boolean;
  message: string;
}

export class StripeWebhookService {
  private orderRepository: OrderRepository;
  private stripeService: StripeService;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.stripeService = new StripeService();
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: any, signature: string): Stripe.Event {
    return StripeService.verifyWebhookSignature(payload, signature);
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event: Stripe.Event): Promise<WebhookResult> {
    switch (event.type) {
      case 'checkout.session.completed':
        return await this.handleCheckoutSessionCompleted(event);

      case 'charge.refunded':
        return await this.handleChargeRefunded(event);

      default:
        return {
          processed: false,
          message: `Unhandled event type: ${event.type}`,
        };
    }
  }

  /**
   * Handle checkout session completed
   */
  private async handleCheckoutSessionCompleted(event: Stripe.Event): Promise<WebhookResult> {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;

    if (!sessionId) {
      return {
        processed: false,
        message: 'Missing session ID in webhook event',
      };
    }

    try {
      // Find order by Stripe session ID (more reliable than order number)
      const order = await OrderModel.findOne({ sessionId: sessionId });

      if (!order) {
        logger.error('StripeWebhookService', 'handleCheckoutSessionCompleted', `Order not found for session: ${sessionId}`);
        return {
          processed: false,
          message: `Order not found for session: ${sessionId}`,
        };
      }

      // Prevent duplicate updates
      if (order.paymentStatus === 'PAID') {
        logger.success('StripeWebhookService', 'handleCheckoutSessionCompleted', `Order ${order.orderNumber} already paid - skipping duplicate`);
        return {
          processed: true,
          message: `Order ${order.orderNumber} already processed`,
        };
      }

      // Verify payment status from Stripe
      if (session.payment_status !== 'paid') {
        logger.error('StripeWebhookService', 'handleCheckoutSessionCompleted', `Payment not completed for session ${sessionId}. Status: ${session.payment_status}`);
        return {
          processed: false,
          message: `Payment not completed. Status: ${session.payment_status}`,
        };
      }

      // Update order status
      order.paymentStatus = 'PAID';
      order.orderStatus = 'PENDING';
      order.transactionId = session.payment_intent as string;
      order.paidAt = new Date();

      await order.save();

      logger.success('StripeWebhookService', 'handleCheckoutSessionCompleted', `Order ${order.orderNumber} marked as PAID and CONFIRMED`);

      return {
        processed: true,
        message: `Order ${order.orderNumber} payment confirmed and status updated`,
      };
    } catch (error: any) {
      logger.error('StripeWebhookService', 'handleCheckoutSessionCompleted', `Error processing checkout session: ${error.message}`);
      return {
        processed: false,
        message: `Error processing checkout session: ${error.message}`,
      };
    }
  }

  /**
   * Handle charge refunded — fired by Stripe when a refund completes
   */
  private async handleChargeRefunded(event: Stripe.Event): Promise<WebhookResult> {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = charge.payment_intent as string;

    if (!paymentIntentId) {
      return {
        processed: false,
        message: 'Missing payment_intent in charge.refunded event',
      };
    }

    try {
      const order = await OrderModel.findOne({ transactionId: paymentIntentId });

      if (!order) {
        logger.error('StripeWebhookService', 'handleChargeRefunded', `Order not found for payment intent: ${paymentIntentId}`);
        return {
          processed: false,
          message: `Order not found for payment intent: ${paymentIntentId}`,
        };
      }

      // Already marked — skip duplicate
      if (order.refundStatus === 'COMPLETED') {
        return {
          processed: true,
          message: `Refund for order ${order.orderNumber} already marked as COMPLETED`,
        };
      }

      order.refundStatus = 'COMPLETED';
      order.paymentStatus = 'REFUNDED';
      order.refundedAt = new Date();
      // Capture refundId from charge.refunds if it wasn't saved earlier
      if (!order.refundId && charge.refunds?.data?.length) {
        order.refundId = charge.refunds.data[0].id;
      }

      await order.save();

      logger.success('StripeWebhookService', 'handleChargeRefunded', `Refund completed for order ${order.orderNumber}`);

      return {
        processed: true,
        message: `Refund completed for order ${order.orderNumber}`,
      };
    } catch (error: any) {
      logger.error('StripeWebhookService', 'handleChargeRefunded', `Error processing charge.refunded: ${error.message}`);
      return {
        processed: false,
        message: `Error processing charge.refunded: ${error.message}`,
      };
    }
  }
}
