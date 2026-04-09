import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repository/UserRepository';

export const optionalAuth = async (
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

    // If no token, continue as guest
    if (!token) {
      req.user = undefined;
      next();
      return;
    }

    // Try to verify token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const userRepository = new UserRepository();
    const user = await userRepository.findById(decoded._id || decoded.userId);

    // If user not found, continue as guest
    if (!user) {
      req.user = undefined;
      next();
      return;
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error: any) {
    // If token is invalid/expired, continue as guest
    req.user = undefined;
    next();
  }
};
