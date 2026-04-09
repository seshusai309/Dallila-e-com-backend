import Stripe from 'stripe';
import { logger } from '../utils/logger';

// Initialize Stripe with your secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

logger.success('StripeService', 'init', `Stripe Secret Key: ${stripeSecretKey ? 'Present' : 'Missing'}`);

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not configured in environment variables');
}

const stripe = new Stripe(stripeSecretKey, {
});

export class StripeService {
  // Check if session is still valid (not expired and not completed)
  async isSessionValid(sessionId: string): Promise<{ valid: boolean; session?: Stripe.Checkout.Session }> {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      // Check if session is expired or already completed
      const isExpired = session.expires_at ? session.expires_at < Math.floor(Date.now() / 1000) : false;
      const isCompleted = session.status === 'complete';
      
      const isValid = !isExpired && !isCompleted;
      
      logger.success('StripeService', 'isSessionValid', `Session ${sessionId} validity: ${isValid}`);
      
      return { valid: isValid, session };
    } catch (error: any) {
      logger.error('StripeService', 'isSessionValid', `Failed to check session validity: ${error.message}`);
      return { valid: false };
    }
  }

  // Create checkout session for order (redirect flow)
  async createCheckoutSession(items: any[], successUrl: string, cancelUrl: string, metadata?: any): Promise<Stripe.Checkout.Session> {
    try {
      const lineItems = items.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.title,
            description: `Quantity: ${item.quantity}`,
            images: [item.thumbnail].filter(Boolean),
          },
          unit_amount: Math.round(item.price * 100), // Convert to cents
        },
        quantity: item.quantity,
      }));

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl.includes('{CHECKOUT_SESSION_ID}') ? successUrl : `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        metadata: metadata || {},
        shipping_address_collection: {
          allowed_countries: ['US', 'CA', 'GB'],
        },
      });

      logger.success('StripeService', 'createCheckoutSession', `Created checkout session: ${session.id}`);
      
      return session;
    } catch (error: any) {
      logger.error('StripeService', 'createCheckoutSession', `Failed to create checkout session: ${error.message}`);
      throw error;
    }
  }

  // Retrieve checkout session
  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      logger.success('StripeService', 'retrieveCheckoutSession', `Retrieved checkout session: ${sessionId}`);
      
      return session;
    } catch (error: any) {
      logger.error('StripeService', 'retrieveCheckoutSession', `Failed to retrieve checkout session: ${error.message}`);
      throw error;
    }
  }

  // Create customer (optional, for better customer management)
  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          source: 'ecommerce_backend'
        }
      });

      logger.success('StripeService', 'createCustomer', `Created customer: ${customer.id}`);
      
      return customer;
    } catch (error: any) {
      logger.error('StripeService', 'createCustomer', `Failed to create customer: ${error.message}`);
      throw error;
    }
  }

  // Verify webhook signature
  static verifyWebhookSignature(payload: Buffer | string, signature: string): Stripe.Event {
    try {
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
      }

      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      
      logger.success('StripeService', 'verifyWebhookSignature', `Verified webhook signature for event: ${event.type}`);
      
      return event;
    } catch (error: any) {
      logger.error('StripeService', 'verifyWebhookSignature', `Failed to verify webhook signature: ${error.message}`);
      throw error;
    }
  }

  // Handle webhook events
  static async handleWebhookEvent(event: Stripe.Event): Promise<{ processed: boolean; message: string }> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          logger.success('StripeService', 'handleWebhookEvent', `Payment succeeded: ${paymentIntent.id}`);
          return { 
            processed: true, 
            message: `Payment ${paymentIntent.id} succeeded` 
          };

        case 'payment_intent.payment_failed':
          const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
          logger.error('StripeService', 'handleWebhookEvent', `Payment failed: ${failedPaymentIntent.id}`);
          return { 
            processed: true, 
            message: `Payment ${failedPaymentIntent.id} failed` 
          };

        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          logger.success('StripeService', 'handleWebhookEvent', `Checkout session completed: ${session.id}`);
          return { 
            processed: true, 
            message: `Checkout session ${session.id} completed` 
          };

        default:
          logger.success('StripeService', 'handleWebhookEvent', `Unhandled event type: ${event.type}`);
          return { 
            processed: false, 
            message: `Unhandled event type: ${event.type}` 
          };
      }
    } catch (error: any) {
      logger.error('StripeService', 'handleWebhookEvent', `Error handling webhook event: ${error.message}`);
      throw error;
    }
  }

  // Get payment methods for a customer
  async getCustomerPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      logger.success('StripeService', 'getCustomerPaymentMethods', `Retrieved ${paymentMethods.data.length} payment methods for customer: ${customerId}`);
      
      return paymentMethods.data;
    } catch (error: any) {
      logger.error('StripeService', 'getCustomerPaymentMethods', `Failed to get payment methods: ${error.message}`);
      throw error;
    }
  }

  // Create refund using payment intent ID (preferred when transactionId is already stored)
  async createRefundByPaymentIntent(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    try {
      const refundData: any = { payment_intent: paymentIntentId };
      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }
      const refund = await stripe.refunds.create(refundData);
      logger.success('StripeService', 'createRefundByPaymentIntent', `Created refund: ${refund.id} for payment intent: ${paymentIntentId}`);
      return refund;
    } catch (error: any) {
      logger.error('StripeService', 'createRefundByPaymentIntent', `Failed to create refund: ${error.message}`);
      throw error;
    }
  }

  // Create refund for checkout session
  async createRefund(sessionId: string, amount?: number, reason?: string): Promise<Stripe.Refund> {
    try {
      // First retrieve the session to get the payment intent
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (!session.payment_intent) {
        throw new Error('No payment intent found for this session');
      }

      const refundData: any = {
        payment_intent: session.payment_intent,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      if (reason) {
        refundData.reason = reason;
      }

      const refund = await stripe.refunds.create(refundData);

      logger.success('StripeService', 'createRefund', `Created refund: ${refund.id} for session: ${sessionId}`);
      
      return refund;
    } catch (error: any) {
      logger.error('StripeService', 'createRefund', `Failed to create refund: ${error.message}`);
      throw error;
    }
  }
}
