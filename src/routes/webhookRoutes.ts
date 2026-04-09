import { Router } from 'express';
import { StripeWebhookController } from '../controller/StripeWebhookController';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();
const stripeWebhookController = new StripeWebhookController();

/**
 * @access public (Stripe webhook)
 * @route POST /stripe
 * @desc Handle Stripe webhook events
 */
router.post(
  '/stripe',
  rateLimiter({ windowMs: 1 * 60 * 1000, max: 100 }), // Higher limit for webhooks
  stripeWebhookController.handleWebhook.bind(stripeWebhookController)
);

export default router;
