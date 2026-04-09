import { User, IUser, UserStatus, UserRole } from '../models/User';

export class UserRepository {
  // Create new user
  async create(userData: Partial<IUser>): Promise<IUser> {
    try {
      const user = new User(userData);
      await user.save();
      return user;
    } catch (error: any) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  // Find user by ID
  async findById(userId: string): Promise<IUser | null> {
    try {
      return await User.findById(userId).select('-password');
    } catch (error: any) {
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
  }

  // Find user by ID with password (for password verification)
  async findByIdWithPassword(userId: string): Promise<IUser | null> {
    try {
      return await User.findById(userId).select('+password');
    } catch (error: any) {
      throw new Error(`Failed to fetch user with password: ${error.message}`);
    }
  }

  // Find user by email (for authentication)
  async findByEmail(email: string): Promise<IUser | null> {
    try {
      return await User.findOne({ email }).select('+password');
    } catch (error: any) {
      throw new Error(`Failed to fetch user by email: ${error.message}`);
    }
  }

  // Find user by username
  async findByUsername(username: string): Promise<IUser | null> {
    try {
      return await User.findOne({ username }).select('-password').lean();
    } catch (error: any) {
      throw new Error(`Failed to fetch user by username: ${error.message}`);
    }
  }

  // Find user by email or username (for registration check)
  async findByEmailOrUsername(email: string, username: string): Promise<IUser | null> {
    try {
      return await User.findOne({
        $or: [{ email }, { username }]
      }).select('-password').lean();
    } catch (error: any) {
      throw new Error(`Failed to check user existence: ${error.message}`);
    }
  }

  // Find users by role
  async findByRole(role: UserRole): Promise<IUser[]> {
    try {
      return await User.find({ role }).select('-password -__v').lean();
    } catch (error: any) {
      throw new Error(`Failed to find users by role: ${error.message}`);
    }
  }

  // Find users by status
  async findByStatus(status: UserStatus): Promise<IUser[]> {
    try {
      return await User.find({ status }).select('-password').lean();
    } catch (error: any) {
      throw new Error(`Failed to find users by status: ${error.message}`);
    }
  }

  // Update user by ID
  async updateById(userId: string, updateData: Partial<IUser>): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');
    } catch (error: any) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  // Update user status
  async updateStatus(userId: string, status: UserStatus): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { status },
        { new: true, runValidators: true }
      ).select('-password');
    } catch (error: any) {
      throw new Error(`Failed to update user status: ${error.message}`);
    }
  }

  // Update user role
  async updateRole(userId: string, role: UserRole): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { role },
        { new: true, runValidators: true }
      ).select('-password');
    } catch (error: any) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }
  }

  // Update customer data
  async updateCustomerData(userId: string, customerData: any): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { customerData },
        { new: true, runValidators: true }
      ).select('-password');
    } catch (error: any) {
      throw new Error(`Failed to update customer data: ${error.message}`);
    }
  }

  // Update OTP for email verification
  async updateOTP(userId: string, otp: string, otpExpires: Date): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { otp, otpExpires },
        { new: true, runValidators: true }
      ).select('-password');
    } catch (error: any) {
      throw new Error(`Failed to update OTP: ${error.message}`);
    }
  }

  // Clear OTP after verification
  async clearOTP(userId: string): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { $unset: { otp: 1, otpExpires: 1 } },
        { new: true }
      ).select('-password');
    } catch (error: any) {
      throw new Error(`Failed to clear OTP: ${error.message}`);
    }
  }

  // Delete user by ID
  async delete(userId: string): Promise<boolean> {
    try {
      const result = await User.findByIdAndDelete(userId);
      return result !== null;
    } catch (error: any) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  // Get all users
  async findAll(): Promise<IUser[]> {
    try {
      return await User.find({}).select('-password').lean();
    } catch (error: any) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
  }

  // Update password and clear OTP
  async updatePasswordAndClearOtp(userId: string, hashedPassword: string): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { password: hashedPassword, $unset: { otp: 1, otpExpires: 1 } },
        { new: true, runValidators: true }
      ).select('-password');
    } catch (error: any) {
      throw new Error(`Failed to update password and clear OTP: ${error.message}`);
    }
  }

  // Update username and clear OTP
  async updateUsernameAndClearOtp(userId: string, username: string): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { username, $unset: { otp: 1, otpExpires: 1 } },
        { new: true, runValidators: true }
      ).select('-password');
    } catch (error: any) {
      throw new Error(`Failed to update username and clear OTP: ${error.message}`);
    }
  }

  // Clear profile update data (OTP, otpExpires, pendingUpdate)
  async clearProfileUpdateData(userId: string): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { $unset: { otp: 1, otpExpires: 1, pendingUpdate: 1 } },
        { new: true, runValidators: true }
      ).select('-password');
    } catch (error: any) {
      throw new Error(`Failed to clear profile update data: ${error.message}`);
    }
  }
}
