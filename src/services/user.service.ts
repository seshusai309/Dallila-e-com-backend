import bcrypt from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { UserRepository } from '../repository/UserRepository';
import { IUser, UserStatus, UserRole } from '../models/User';
import { AddressRepository } from '../repository/AddressRepository';
import { RegisterUserInput } from '../validators/user.validator';
import { UserResponseDto } from '../dtos/user.dto';
import { emailService } from '../utils/emailService';
import { UserExistsError, EmailSendFailedError, EmailNotVerifiedError, InvalidCredentialsError, AccountNotActiveError, UserNotFoundError } from '../utils/errors/user.errors';
import { logger } from '../utils/logger';

export class UserService {
  private userRepository: UserRepository;
  private addressRepository: AddressRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.addressRepository = new AddressRepository();
  }

  /**
   * Register a new user with address
   * All business logic is contained here
   */
  async register(data: RegisterUserInput): Promise<{ user: UserResponseDto }> {
    // 1. Check if user already exists (validation already done in middleware)
    const existingUser = await this.userRepository.findByEmailOrUsername(
      data.email,
      data.username
    );
    if (existingUser) {
      // If user exists but not verified, tell them to verify email
      if (existingUser.status === UserStatus.INACTIVE) {
        throw new EmailNotVerifiedError();
      }
      // If user exists and is verified, tell them user exists
      throw new UserExistsError();
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // 3. Create new user with INACTIVE status and USER role
    const userData: Partial<IUser> = {
      username: data.username,
      email: data.email,
      password: hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      phoneNumber: data.phoneNumber,
      countryCode: data.countryCode,
      status: UserStatus.INACTIVE,
      role: UserRole.USER,
    };

    const user = await this.userRepository.create(userData);

    // 4. Create address in the Address collection (default since it's the first)
    await this.addressRepository.create({
      userId: user._id.toString(),
      street: data.address.street,
      city: data.address.city,
      state: data.address.state,
      postalCode: data.address.postalCode,
      country: data.address.country,
      isDefault: true,
      addressType: data.address.addressType || 'home',
    });

    // 5. Generate and save OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
    
    await this.userRepository.updateOTP(
      user._id.toString(),
      otp,
      otpExpiry
    );

    // 6. Send OTP email
    const emailSent = await emailService.sendOTP(user.email, otp);
    if (!emailSent) {
      logger.error('system', 'register', `Failed to send OTP email to ${user.email}`);
      throw new EmailSendFailedError();
    }

    logger.success('anonymous', 'register', `User registered successfully: ${user.email}, OTP sent`);

    // 7. Transform to DTO using class-transformer
    const userDto = plainToInstance(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });

    return { user: userDto };
  }

  /**
   * Login user with email and password
   */
  async login(email: string, password: string): Promise<{ user: UserResponseDto; token: string }> {
    // 1. Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    // 2. Check if user is active (USER role only needs to be verified)
    if (user.role === UserRole.USER && user.status !== UserStatus.ACTIVE) {
      throw new AccountNotActiveError();
    }

    // 3. Auto-activate admin accounts if not active
    if ((user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) && user.status !== UserStatus.ACTIVE) {
      await this.userRepository.updateById(user._id.toString(), { status: UserStatus.ACTIVE });
      user.status = UserStatus.ACTIVE;
    }

    // 4. Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
    }

    // 5. Generate JWT token
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // 6. Transform to DTO
    const userDto = plainToInstance(UserResponseDto, user.toObject(), {
      excludeExtraneousValues: true,
    });

    logger.success(user.username, 'login', 'User logged in successfully');

    return { user: userDto, token };
  }
}
