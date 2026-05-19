import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../repository/UserRepository';
import { AddressRepository } from '../repository/AddressRepository';
import { UserStatus, UserRole } from '../models/User';
import { logger } from '../utils/logger';
import { emailService } from '../utils/emailService';
import { UserService } from '../services/user.service';
import bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { SendOtpResponseDto, VerifyOtpResponseDto, ProfileResponseDto, UpdateProfileResponseDto } from '../dtos/user.dto';
import { AddressResponseDto } from '../dtos/address.dto';

export class UserController {
  private userRepository: UserRepository;
  private addressRepository: AddressRepository;
  private userService: UserService;

  constructor() {
    this.userRepository = new UserRepository();
    this.addressRepository = new AddressRepository();
    this.userService = new UserService();
  }

  // Register new user (USER role only)
  async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.userService.register(req.body);

      res.status(201).json({
        success: true,
        code: 'USER_REGISTERED',
        message: 'User registered successfully. Please check your email for OTP verification.',
        data: {
          user: result.user
        }
      });
    } catch (error: any) {
      logger.error('anonymous', 'register', `Registration failed: ${error.message}`);
      
      // Handle different error types with proper codes
      if (error.message.includes('not verified')) {
        res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_NOT_VERIFIED',
            message: error.message
          }
        });
      } else if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: error.message
          }
        });
      } else if (error.message.includes('Failed to send OTP email')) {
        res.status(500).json({
          success: false,
          error: {
            code: 'EMAIL_SENT_FAILED',
            message: 'Failed to send OTP email. Please try again.'
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'REGISTRATION_ERROR',
            message: 'Registration failed. Please try again.'
          }
        });
      }
    }
  }

  // Login user (email and password only)
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      const result = await this.userService.login(email, password);

      res.status(200).json({
        success: true,
        code: 'LOGIN_SUCCESS',
        message: 'Login successful',
        data: {
          user: result.user,
          token: result.token
        }
      });
    } catch (error: any) {
      logger.error('anonymous', 'login', `Login failed: ${error.message}`);

      // Handle different error types with proper codes
      if (error.message.includes('Invalid email or password')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: error.message
          }
        });
      } else if (error.message.includes('Account not active')) {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_NOT_ACTIVE',
            message: error.message
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'LOGIN_ERROR',
            message: 'Login failed. Please try again.'
          }
        });
      }
    }
  }

  // Send OTP to user email (for registration, password reset, or profile update)
  async sendOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email, purpose } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Email is required',
            field: 'email'
          }
        });
        return;
      }

      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User with this email does not exist'
          }
        });
        return;
      }

      // Generate 4-digit OTP
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Handle different purposes
      const availablePurposes = ['registration', 'password_reset'];

      if (purpose && !availablePurposes.includes(purpose)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PURPOSE',
            message: `Invalid purpose: '${purpose}'.`,
            availablePurposes: availablePurposes
          }
        });
        return;
      }

      switch (purpose) {
        case 'password_reset':
          // Save OTP for password reset
          await this.userRepository.updateOTP(user._id.toString(), otp, otpExpiry);
          
          // Send password reset email
          const passwordResetEmailSent = await emailService.sendPasswordResetOTP(email, otp);
          
          if (passwordResetEmailSent) {
            logger.success(email, 'sendOtp', `Password reset OTP sent successfully`);
            const responseDto = plainToInstance(SendOtpResponseDto, {
              email: email,
              purpose: 'password_reset',
              otpExpiry: otpExpiry
            }, { excludeExtraneousValues: true });
            res.status(200).json({
              success: true,
              code: 'OTP_SENT',
              message: 'Password reset OTP sent to your email',
              data: responseDto
            });
          } else {
            logger.error(email, 'sendOtp', 'Failed to send password reset OTP email');
            res.status(500).json({
              success: false,
              error: {
                code: 'EMAIL_SENT_FAILED',
                message: 'Email service unavailable. Please try again later.'
              }
            });
          }
          break;

        case 'registration':
          // Save OTP for registration
          await this.userRepository.updateOTP(user._id.toString(), otp, otpExpiry);
          
          // Send registration email
          const registrationEmailSent = await emailService.sendOTP(email, otp);
          
          if (registrationEmailSent) {
            logger.success(email, 'sendOtp', `Registration OTP sent successfully`);
            const responseDto = plainToInstance(SendOtpResponseDto, {
              email: email,
              purpose: 'registration',
              otpExpiry: otpExpiry
            }, { excludeExtraneousValues: true });
            res.status(200).json({
              success: true,
              code: 'OTP_SENT',
              message: 'Registration OTP sent to your email',
              data: responseDto
            });
          } else {
            logger.error(email, 'sendOtp', 'Failed to send registration OTP email');
            res.status(500).json({
              success: false,
              error: {
                code: 'EMAIL_SENT_FAILED',
                message: 'Email service unavailable. Please try again later.'
              }
            });
          }
          break;

        default:
          // Handle case where no purpose is provided or other cases
          res.status(400).json({
            success: false,
            error: {
              code: 'PURPOSE_REQUIRED',
              message: 'Purpose is required. Available purposes: registration, password_reset'
            }
          });
          break;
      }
    } catch (error: any) {
      logger.error(req.body?.email || 'unknown', 'sendOtp', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'OTP_SEND_ERROR',
          message: 'Failed to send OTP. Please try again.'
        }
      });
    }
  }

  // Reset Password with OTP
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;

      if (!email || !otp || !newPassword) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Email, OTP, and new password are required',
            field: 'email, otp, newPassword'
          }
        });
        return;
      }

      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User with this email does not exist'
          }
        });
        return;
      }

      // Verify OTP
      if (!user.otp || user.otp !== otp || !user.otpExpires || user.otpExpires < new Date()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OTP',
            message: 'Invalid or expired OTP'
          }
        });
        return;
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and clear OTP
      await this.userRepository.updatePasswordAndClearOtp(user._id.toString(), hashedPassword);

      logger.success(email, 'resetPassword', 'Password reset successfully');

      res.status(200).json({
        success: true,
        code: 'PASSWORD_RESET_SUCCESS',
        message: 'Password reset successfully. Please login with your new password.'
      });
    } catch (error: any) {
      logger.error('anonymous', 'resetPassword', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'PASSWORD_RESET_ERROR',
          message: 'Password reset failed. Please try again.'
        }
      });
    }
  }

  // Update Profile (OTP required only for password change)
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const currentUser = req.user;

      if (!currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      const { username, email, firstName, lastName, phoneNumber, countryCode, oldPassword, password } = req.body;

      // Build update object from provided fields
      const updateData: Record<string, any> = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (countryCode !== undefined) updateData.countryCode = countryCode;

      if (Object.keys(updateData).length === 0 && !password) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_FIELDS',
            message: 'At least one field must be provided to update'
          }
        });
        return;
      }

      // Old password verification — required only for password change
      if (password) {
        // Get user with password field for verification
        const freshUser = await this.userRepository.findByIdWithPassword(currentUser._id.toString());
        if (!freshUser) {
          res.status(404).json({
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found'
            }
          });
          return;
        }

        // Verify old password
        const isOldPasswordValid = await bcrypt.compare(oldPassword, freshUser.password);
        if (!isOldPasswordValid) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_OLD_PASSWORD',
              message: 'Old password is incorrect'
            }
          });
          return;
        }

        updateData.password = await bcrypt.hash(password, 10);
      }

      // Validate uniqueness for username
      if (updateData.username) {
        const existingUser = await this.userRepository.findByUsername(updateData.username);
        if (existingUser && existingUser._id.toString() !== currentUser._id.toString()) {
          res.status(409).json({
            success: false,
            error: {
              code: 'USERNAME_EXISTS',
              message: 'Username is already taken'
            }
          });
          return;
        }
      }

      // Validate uniqueness for email
      if (updateData.email) {
        const existingUser = await this.userRepository.findByEmail(updateData.email);
        if (existingUser && existingUser._id.toString() !== currentUser._id.toString()) {
          res.status(409).json({
            success: false,
            error: {
              code: 'EMAIL_EXISTS',
              message: 'Email is already registered'
            }
          });
          return;
        }
      }

      const updatedUser = await this.userRepository.updateById(currentUser._id.toString(), updateData);

      // Clear OTP after successful password change
      if (password) {
        await this.userRepository.clearProfileUpdateData(currentUser._id.toString());
      }

      logger.success(currentUser.email, 'updateProfile', `Profile updated successfully`);

      const responseDto = plainToInstance(UpdateProfileResponseDto, {
        _id: updatedUser?._id,
        username: updatedUser?.username,
        email: updatedUser?.email,
        role: updatedUser?.role,
        status: updatedUser?.status,
        updatedFields: Object.keys(updateData).filter(k => k !== 'password').concat(password ? ['password'] : [])
      }, { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'PROFILE_UPDATED',
        message: 'Profile updated successfully',
        data: responseDto
      });
    } catch (error: any) {
      logger.error(req.user?.email || 'unknown', 'updateProfile', error.message);
      res.status(500).json({
        success: false,
        error: {
          code: 'PROFILE_UPDATE_ERROR',
          message: 'Profile update failed. Please try again.'
        }
      });
    }
  }

  // Logout user
  async logout(req: Request, res: Response): Promise<void> {
    try {
      logger.success(req.user?.username || 'anonymous', 'logout', 'User logged out successfully');

      res.status(200).json({
        success: true,
        code: 'LOGOUT_SUCCESS',
        message: 'Logout successful'
      });
    } catch (error: any) {
      logger.error('anonymous', 'logout', `Logout failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_ERROR',
          message: 'Logout failed. Please try again.'
        }
      });
    }
  }

  // Verify OTP and update status to ACTIVE
  async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Email and OTP are required',
            field: 'email, otp'
          }
        });
        return;
      }

      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found'
          }
        });
        return;
      }

      // Check if OTP matches and is not expired
      if (!user.otp || user.otp !== otp) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OTP',
            message: 'Invalid OTP'
          }
        });
        return;
      }

      if (!user.otpExpires || user.otpExpires < new Date()) {
        res.status(400).json({
          success: false,
          error: {
            code: 'OTP_EXPIRED',
            message: 'OTP expired. Please request a new one.'
          }
        });
        return;
      }

      // Update status to ACTIVE and clear OTP
      const updatedUser = await this.userRepository.updateStatus(user._id.toString(), UserStatus.ACTIVE);
      await this.userRepository.clearOTP(user._id.toString());

      logger.success(user.username, 'verifyOtp', `OTP verified successfully, account activated for ${email}`);

      const responseDto = plainToInstance(VerifyOtpResponseDto, {
        _id: updatedUser?._id,
        email: updatedUser?.email,
        status: updatedUser?.status
      }, { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'OTP_VERIFIED',
        message: 'OTP verified successfully. Your account is now active. You can login now.',
        data: responseDto
      });
    } catch (error: any) {
      logger.error('anonymous', 'verifyOtp', `OTP verification failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'OTP_VERIFICATION_ERROR',
          message: 'OTP verification failed. Please try again.'
        }
      });
    }
  }

  // Get user profile
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      logger.success(user.username, 'getProfile', `Profile retrieved for ${user.email}`);

      const addresses = await this.addressRepository.findByUserId(user._id.toString());
      const addressDtos = addresses.map(a =>
        plainToInstance(AddressResponseDto, a.toObject(), { excludeExtraneousValues: true })
      );

      const responseDto = plainToInstance(ProfileResponseDto, {
        _id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        status: user.status,
        addresses: addressDtos,
        discountPercent: user.discountPercent,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }, { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'PROFILE_RETRIEVED',
        message: 'Profile retrieved successfully',
        data: { user: responseDto }
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'unknown', 'getProfile', `Failed to get profile: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'PROFILE_ERROR',
          message: 'Failed to retrieve profile. Please try again.'
        }
      });
    }
  }
}
