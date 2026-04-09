import { UserRepository } from '../repository/UserRepository';
import { AddressRepository } from '../repository/AddressRepository';
import { IUser, UserStatus, UserRole } from '../models/User';
import bcrypt from 'bcryptjs';
import { AdminNotFoundError, AdminAlreadyExistsError, CannotModifySuperAdminError, UserNotAdminError } from '../utils/errors/admin.errors';

export interface CreateAdminInput {
  username: string;
  email: string;
  password: string;
}

export interface UpdateAdminInput {
  username?: string;
  email?: string;
  status?: UserStatus;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    recordsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export class AdminService {
  private userRepository: UserRepository;
  private addressRepository: AddressRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.addressRepository = new AddressRepository();
  }

  /**
   * Get all users with USER role only (admin only)
   */
  async getAllUsers(page: number = 1, limit: number = 20): Promise<PaginatedResult<IUser>> {
    const skip = (page - 1) * limit;

    const allUsers = await this.userRepository.findByRole(UserRole.USER);
    const totalRecords = allUsers.length;
    const data = allUsers.slice(skip, skip + limit);

    const totalPages = Math.ceil(totalRecords / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        recordsPerPage: limit,
        hasNextPage,
        hasPrevPage,
      },
    };
  }

  /**
   * Get user by ID (admin only)
   */
  async getUserById(userId: string): Promise<IUser> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AdminNotFoundError('User not found');
    }
    return user;
  }

  /**
   * Update user by ID (admin only)
   */
  async updateUser(userId: string, updateData: Partial<IUser>): Promise<IUser> {
    const user = await this.userRepository.updateById(userId, updateData);
    if (!user) {
      throw new AdminNotFoundError('User not found');
    }
    return user;
  }

  /**
   * Delete user by ID (admin only)
   */
  async deleteUser(userId: string): Promise<void> {
    const success = await this.userRepository.delete(userId);
    if (!success) {
      throw new AdminNotFoundError('User not found');
    }
  }

  /**
   * Create admin user (SUPER_ADMIN only)
   */
  async createAdmin(data: CreateAdminInput): Promise<IUser> {
    const { username, email, password } = data;

    // Check if admin already exists
    const existingUser = await this.userRepository.findByEmailOrUsername(email, username);
    if (existingUser) {
      throw new AdminAlreadyExistsError();
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const adminData = {
      username,
      email,
      password: hashedPassword,
      status: UserStatus.ACTIVE,
      role: UserRole.ADMIN,
    };

    const adminUser = await this.userRepository.create(adminData);

    // Create default address for admin
    await this.addressRepository.create({
      userId: adminUser._id.toString(),
      street: "Admin Office",
      city: "Headquarters",
      state: "Admin State",
      postalCode: "000000",
      country: "Admin Country",
      isDefault: true,
      addressType: 'work',
    });

    return adminUser;
  }

  /**
   * Delete admin user (SUPER_ADMIN only)
   */
  async deleteAdminUser(adminId: string): Promise<void> {
    const adminUser = await this.userRepository.findById(adminId);
    if (!adminUser) {
      throw new AdminNotFoundError('Admin user not found');
    }

    // Prevent deleting SUPER_ADMIN users
    if (adminUser.role === UserRole.SUPER_ADMIN) {
      throw new CannotModifySuperAdminError('Cannot delete SUPER_ADMIN users');
    }

    // Ensure the user being deleted is an admin
    if (adminUser.role !== UserRole.ADMIN) {
      throw new UserNotAdminError();
    }

    await this.userRepository.delete(adminId);
  }

  /**
   * Get admin by ID (SUPER_ADMIN only)
   */
  async getAdminById(adminId: string): Promise<IUser> {
    const adminUser = await this.userRepository.findById(adminId);
    if (!adminUser) {
      throw new AdminNotFoundError('Admin user not found');
    }

    // Ensure the user is an admin or super admin
    if (adminUser.role !== UserRole.ADMIN && adminUser.role !== UserRole.SUPER_ADMIN) {
      throw new UserNotAdminError();
    }

    return adminUser;
  }

  /**
   * Update admin user details (SUPER_ADMIN only)
   */
  async updateAdminUser(adminId: string, data: UpdateAdminInput): Promise<IUser> {
    const adminUser = await this.userRepository.findById(adminId);
    if (!adminUser) {
      throw new AdminNotFoundError('Admin user not found');
    }

    // Prevent updating SUPER_ADMIN users
    if (adminUser.role === UserRole.SUPER_ADMIN) {
      throw new CannotModifySuperAdminError('Cannot update SUPER_ADMIN user details');
    }

    // Ensure the user being updated is an admin
    if (adminUser.role !== UserRole.ADMIN) {
      throw new UserNotAdminError();
    }

    const updateData: any = {};

    // Validate and add username if provided
    if (data.username) {
      if (data.username !== adminUser.username) {
        const existingUsername = await this.userRepository.findByUsername(data.username);
        if (existingUsername && existingUsername._id.toString() !== adminUser._id.toString()) {
          throw new AdminAlreadyExistsError('Username already taken');
        }
        updateData.username = data.username;
      }
    }

    // Validate and add email if provided
    if (data.email) {
      if (data.email !== adminUser.email) {
        const existingEmail = await this.userRepository.findByEmail(data.email);
        if (existingEmail && existingEmail._id.toString() !== adminUser._id.toString()) {
          throw new AdminAlreadyExistsError('Email already registered');
        }
        updateData.email = data.email;
      }
    }

    // Add status if provided and valid
    if (data.status) {
      const validStatuses = [UserStatus.ACTIVE, UserStatus.INACTIVE];
      if (!validStatuses.includes(data.status)) {
        throw new Error('Invalid status. Valid statuses are: ACTIVE, INACTIVE');
      }
      updateData.status = data.status;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update');
    }

    const updatedAdmin = await this.userRepository.updateById(adminId, updateData);
    if (!updatedAdmin) {
      throw new AdminNotFoundError('Failed to update admin user');
    }

    return updatedAdmin;
  }

  /**
   * Get all admin users (SUPER_ADMIN only)
   */
  async getAdminsList(page: number = 1, limit: number = 20): Promise<PaginatedResult<IUser>> {
    const skip = (page - 1) * limit;

    const allAdminUsers = await this.userRepository.findByRole(UserRole.ADMIN);

    const totalRecords = allAdminUsers.length;
    const data = allAdminUsers.slice(skip, skip + limit);

    const totalPages = Math.ceil(totalRecords / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      data,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        recordsPerPage: limit,
        hasNextPage,
        hasPrevPage,
      },
    };
  }
}
