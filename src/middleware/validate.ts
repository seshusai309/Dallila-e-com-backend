import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

/**
 * Generic validation middleware factory
 * Validates request body against provided Zod schema
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0]; // Take first error
        const field = issue.path.join('.');
        const message = issue.message;

        logger.warn('anonymous', 'validate', `Validation failed: ${field} - ${message}`);

        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message,
            field,
          },
        });
        return;
      }

      next(error);
    }
  };
};
