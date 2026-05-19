import { Expose, Type } from 'class-transformer';
import { BaseDto } from './base.dto';
import { AddressResponseDto } from './address.dto';

// User Response DTO for registration
export class UserResponseDto extends BaseDto {
  @Expose()
  username!: string;

  @Expose()
  email!: string;

  @Expose()
  firstName!: string;

  @Expose()
  lastName!: string;

  @Expose()
  phoneNumber!: string;

  @Expose()
  countryCode!: string;

  @Expose()
  status!: string;

  @Expose()
  role!: string;
}

// Login Response DTO
export class LoginResponseDto {
  @Expose()
  user!: UserResponseDto;

  @Expose()
  token!: string;
}

// Send OTP Response DTO
export class SendOtpResponseDto {
  @Expose()
  email!: string;

  @Expose()
  purpose!: string;

  @Expose()
  otpExpiry!: Date;

  @Expose()
  updateData?: Record<string, any>;
}

// Verify OTP Response DTO
export class VerifyOtpResponseDto {
  @Expose()
  _id!: string;

  @Expose()
  email!: string;

  @Expose()
  status!: string;
}

// Profile Response DTO
export class ProfileResponseDto {
  @Expose()
  _id!: string;

  @Expose()
  username!: string;

  @Expose()
  email!: string;

  @Expose()
  firstName!: string;

  @Expose()
  lastName!: string;

  @Expose()
  phoneNumber!: string;

  @Expose()
  role!: string;

  @Expose()
  status!: string;

  @Expose()
  @Type(() => AddressResponseDto)
  addresses!: AddressResponseDto[];

  @Expose()
  discountPercent!: number;

  @Expose()
  createdAt!: Date;

  @Expose()
  updatedAt!: Date;
}

// Update Profile Response DTO
export class UpdateProfileResponseDto {
  @Expose()
  _id!: string;

  @Expose()
  username!: string;

  @Expose()
  email!: string;

  @Expose()
  role!: string;

  @Expose()
  status!: string;

  @Expose()
  updatedFields!: string[];
}
