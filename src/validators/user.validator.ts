import { z } from 'zod';

// Inline address schema used only for registration
const RegistrationAddressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
  isDefault: z.boolean().optional().default(false),
  addressType: z.enum(['home', 'work', 'billing', 'shipping']).optional().default('home'),
});

// User registration validation schema
export const RegisterUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters'),
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be at most 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be at most 50 characters'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  countryCode: z.string().min(1, 'Country code is required'),
  address: RegistrationAddressSchema,
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Export type for TypeScript
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;

// Login validation schema
export const LoginSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

// Send OTP validation schema
export const SendOtpSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  purpose: z.enum(['registration', 'password_reset']).optional(),
});

// Verify OTP validation schema
export const VerifyOtpSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  otp: z.string().min(1, 'OTP is required'),
});

// Reset Password validation schema
export const ResetPasswordSchema = z.object({
  email: z.string().email().transform(v => v.toLowerCase()),
  otp: z.string().min(1, 'OTP is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

// Export types
export type LoginInput = z.infer<typeof LoginSchema>;
export type SendOtpInput = z.infer<typeof SendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

// Update Profile validation schema
export const UpdateProfileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters').optional(),
  email: z.string().email().transform(v => v.toLowerCase()).optional(),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be at most 50 characters').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be at most 50 characters').optional(),
  phoneNumber: z.string().optional(),
  countryCode: z.string().optional(),
  oldPassword: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
}).superRefine((data, ctx) => {
  if (data.password && !data.oldPassword) {
    ctx.addIssue({
      code: 'custom',
      message: 'Old password is required when changing password',
      path: ['oldPassword'],
    });
  }
});

// Admin create user validation schema (minimal for admin creation)
export const AdminCreateSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters'),
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Admin create user validation schema (full user creation)
export const AdminCreateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters'),
  email: z.string().email().transform(v => v.toLowerCase()),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be at most 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be at most 50 characters'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  countryCode: z.string().min(1, 'Country code is required'),
  role: z.enum(['user', 'admin', 'super_admin']),
  status: z.enum(['active', 'inactive', 'suspended']).optional().default('active'),
});

// Admin update user validation schema (partial update)
export const AdminUpdateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30, 'Username must be at most 30 characters').optional(),
  email: z.string().email().transform(v => v.toLowerCase()).optional(),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name must be at most 50 characters').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name must be at most 50 characters').optional(),
  phoneNumber: z.string().optional(),
  countryCode: z.string().optional(),
  role: z.enum(['user', 'admin', 'super_admin']).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

// Export types
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type AdminCreateInput = z.infer<typeof AdminCreateSchema>;
export type AdminCreateUserInput = z.infer<typeof AdminCreateUserSchema>;
export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;
