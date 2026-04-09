import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

const defaultWindowMs = parseInt(process.env.RATE_LIMIT ?? '', 10) || 900000;

interface RateLimitOptions {
  windowMs?: number;
  max: number;
}

/**
 * Calculate retry after time
 * Returns seconds remaining for the error response
 */
const calculateRetryAfterSeconds = (req: Request, windowMs: number): number => {
  const resetTime = (req as any).rateLimit?.resetTime as number | undefined;
  const retryAfterMs = (resetTime || Date.now() + windowMs) - Date.now();
  return Math.ceil(retryAfterMs / 1000);
};

/**
 * Factory function to create a rate limiter with retryAfter info
 * Shows time remaining in "X min Y sec" format
 */
export const rateLimiter = ({ windowMs = defaultWindowMs, max }: RateLimitOptions) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const retryAfterSeconds = calculateRetryAfterSeconds(req, windowMs);

      logger.warn('system', 'rateLimit', `Rate limit exceeded for IP: ${req.ip} on ${req.path}`);

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, rate limit exceeded.',
          retryAfter: retryAfterSeconds
        }
      });
    },
  });
};
