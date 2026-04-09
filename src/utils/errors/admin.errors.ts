import { AppError } from './app.error';

export class AdminNotFoundError extends AppError {
  constructor(message: string = 'Admin or user not found') {
    super(message, 'ADMIN_NOT_FOUND', 404);
  }
}

export class AdminAlreadyExistsError extends AppError {
  constructor(message: string = 'Admin user with this email or username already exists') {
    super(message, 'ADMIN_ALREADY_EXISTS', 409);
  }
}

export class CannotModifySuperAdminError extends AppError {
  constructor(message: string = 'Cannot modify SUPER_ADMIN users') {
    super(message, 'CANNOT_MODIFY_SUPER_ADMIN', 403);
  }
}

export class UserNotAdminError extends AppError {
  constructor(message: string = 'User is not an admin') {
    super(message, 'USER_NOT_ADMIN', 400);
  }
}
