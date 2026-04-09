import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repository/UserRepository';

// Authentication middleware (Authorization header)
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get JWT_SECRET at runtime to ensure dotenv is loaded
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userRepository = new UserRepository();
    const user = await userRepository.findById(decoded._id || decoded.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    } else if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  }
};

// Role-based authentication middleware
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

// User only middleware
export const requireUser = requireRole(['USER']);

// Super admin only middleware
export const requireSuperAdmin = requireRole(['SUPER_ADMIN']);

// Admin or super admin middleware
export const requireAdmin = requireRole(['ADMIN', 'SUPER_ADMIN']);

// User or admin or super admin middleware
export const requireUserOrAdmin = requireRole(['USER', 'ADMIN', 'SUPER_ADMIN']);
