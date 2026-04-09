import { AppError } from './app.error';

export class UserExistsError extends AppError {
  constructor(message: string = 'user with this email already exists') {
    super(message, 'USER_EXISTS', 409);
  }
}

export class EmailNotVerifiedError extends AppError {
  constructor(message: string = 'Email not verified. Please verify your email using OTP.') {
    super(message, 'EMAIL_NOT_VERIFIED', 400);
  }
}

export class EmailSendFailedError extends AppError {
  constructor(message: string = 'Failed to send OTP email') {
    super(message, 'EMAIL_SENT_FAILED', 500);
  }
}

export class RegistrationError extends AppError {
  constructor(message: string = 'Registration failed. Please try again.') {
    super(message, 'REGISTRATION_ERROR', 500);
  }
}

export class InvalidCredentialsError extends AppError {
  constructor(message: string = 'Invalid email or password') {
    super(message, 'INVALID_CREDENTIALS', 401);
  }
}

export class AccountNotActiveError extends AppError {
  constructor(message: string = 'Account not active. Please verify your email first.') {
    super(message, 'ACCOUNT_NOT_ACTIVE', 403);
  }
}

export class UserNotFoundError extends AppError {
  constructor(message: string = 'User not found') {
    super(message, 'USER_NOT_FOUND', 404);
  }
}

export class InvalidOTPError extends AppError {
  constructor(message: string = 'Invalid or expired OTP') {
    super(message, 'INVALID_OTP', 400);
  }
}

export class ProfileUpdateError extends AppError {
  constructor(message: string = 'Profile update failed') {
    super(message, 'PROFILE_UPDATE_ERROR', 500);
  }
}
