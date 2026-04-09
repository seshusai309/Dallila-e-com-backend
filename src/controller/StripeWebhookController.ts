import { Request, Response, NextFunction } from 'express';
import { StripeWebhookService } from '../services/stripeWebhook.service';
import { logger } from '../utils/logger';
import Stripe from 'stripe';

export class StripeWebhookController {
  private stripeWebhookService: StripeWebhookService;

  constructor() {
    this.stripeWebhookService = new StripeWebhookService();
  }

  // Handle Stripe webhooks
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sig = req.headers['stripe-signature'] as string;
      
      if (!sig) {
        logger.error('StripeWebhookController', 'handleWebhook', 'Missing Stripe signature');
        res.status(400).json({
          success: false,
          message: 'Missing Stripe signature'
        });
        return;
      }

      let event: Stripe.Event;

      try {
        // Use raw body directly for signature verification
        event = this.stripeWebhookService.verifyWebhookSignature(req.body, sig);
      } catch (err: any) {
        logger.error('StripeWebhookController', 'handleWebhook', `Webhook signature verification failed: ${err.message}`);
        res.status(400).json({
          success: false,
          message: 'Webhook signature verification failed'
        });
        return;
      }

      // Acknowledge Stripe immediately — Stripe has a 30s timeout and will
      // retry if it doesn't get a 2xx fast enough (especially on cold starts).
      // Process the event asynchronously after responding.
      res.status(200).json({ received: true });

      this.stripeWebhookService.processWebhookEvent(event).then((result) => {
        logger.success('StripeWebhookController', 'handleWebhook', `Processed event ${event.type}: ${result.message}`);
      }).catch((err: any) => {
        logger.error('StripeWebhookController', 'handleWebhook', `Failed to process event ${event.type}: ${err.message}`);
      });
    } catch (error: any) {
      logger.error('StripeWebhookController', 'handleWebhook', `Webhook processing failed: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed'
      });
    }
  }
}
