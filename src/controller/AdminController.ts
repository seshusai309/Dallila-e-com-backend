import { Request, Response, NextFunction } from 'express';
import { UserStatus, UserRole } from '../models/User';
import { logger } from '../utils/logger';
import { AdminService } from '../services/admin.service';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from '../dtos/user.dto';
import { AdminNotFoundError, AdminAlreadyExistsError, CannotModifySuperAdminError, UserNotAdminError } from '../utils/errors/admin.errors';

export class AdminController {
  private adminService: AdminService;

  constructor() {
    this.adminService = new AdminService();
  }

  // Get all users with USER role only (admin only)
  async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.adminService.getAllUsers(page, limit);

      logger.success(currentUser?.username || 'unknown', 'getAllUsers', `Retrieved ${result.data.length} users (page ${page} of ${result.pagination.totalPages})`);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Users retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'getAllUsers', error.message);
      next(error);
    }
  }

  // Get user by ID (admin only)
  async getUserById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      const user = await this.adminService.getUserById(id as string);
      const userDto = plainToInstance(UserResponseDto, user.toObject(), { excludeExtraneousValues: true });
      res.status(200).json({
        success: true,
        data: userDto
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'getUserById', error.message);
      next(error);
    }
  }

  // Update user (admin only)
  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      const user = await this.adminService.updateUser(id as string, req.body);
      const userDto = plainToInstance(UserResponseDto, user.toObject(), { excludeExtraneousValues: true });
      logger.success(currentUser?.username || 'unknown', 'updateUser', `User ${id} updated successfully`);

      res.status(200).json({
        success: true,
        data: userDto,
        message: 'User updated successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'updateUser', error.message);
      next(error);
    }
  }

  // Delete user (admin only)
  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      await this.adminService.deleteUser(id as string);

      logger.success(currentUser?.username || 'unknown', 'deleteUser', `User ${id} deleted successfully`);

      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'deleteUser', error.message);
      next(error);
    }
  }

  // Create admin user (SUPER_ADMIN only)
  async createAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;

      const { username, email, password } = req.body;

      // Validate required fields
      if (!username || !email || !password) {
        res.status(400).json({
          success: false,
          message: 'Username, email, and password are required'
        });
        return;
      }

      const admin = await this.adminService.createAdmin({ username, email, password });

      logger.success(currentUser?.username || 'unknown', 'createAdmin', `Admin user ${email} created successfully`);

      res.status(201).json({
        success: true,
        data: {
          _id: admin._id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          status: admin.status
        },
        message: 'Admin user created successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'createAdmin', error.message);
      next(error);
    }
  }

  // Delete Admin User (SUPER_ADMIN only)
  async deleteAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      await this.adminService.deleteAdminUser(id as string);

      logger.success(currentUser?.username || 'unknown', 'deleteAdminUser', `Admin user deleted successfully`);

      res.status(200).json({
        success: true,
        message: 'Admin user deleted successfully',
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'deleteAdminUser', error.message);
      next(error);
    }
  }

  // Get Admin User by ID (SUPER_ADMIN only)
  async getAdminById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const currentUser = req.user;

      const adminUser = await this.adminService.getAdminById(id as string);

      logger.success(currentUser?.username || 'unknown', 'getAdminById', `Admin user retrieved successfully`);

      res.status(200).json({
        success: true,
        message: 'Admin user retrieved successfully',
        data: adminUser
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'getAdminById', error.message);
      next(error);
    }
  }

  // Update Admin User Details (SUPER_ADMIN only)
  async updateAdminUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { username, email, status } = req.body;
      const currentUser = req.user;

      const updatedAdmin = await this.adminService.updateAdminUser(id as string, { username, email, status });

      logger.success(currentUser?.username || 'unknown', 'updateAdminUser', `Admin user updated successfully`);

      res.status(200).json({
        success: true,
        message: 'Admin user updated successfully',
        data: updatedAdmin
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'updateAdminUser', error.message);
      next(error);
    }
  }

  // Get all admin users (SUPER_ADMIN only)
  async getAdminsList(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.adminService.getAdminsList(page, limit);

      logger.success(currentUser?.username || 'unknown', 'getAdminsList', `Retrieved ${result.data.length} admin users (page ${page} of ${result.pagination.totalPages})`);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        message: 'Admin users retrieved successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'getAdminsList', error.message);
      next(error);
    }
  }
}
