import { AppError } from './app.error';

export class FamilyTargetNotFoundError extends AppError {
  constructor(message: string = 'No user found with this email') {
    super(message, 'FAMILY_TARGET_NOT_FOUND', 404);
  }
}

export class FamilyCannotAddSelfError extends AppError {
  constructor(message: string = 'You cannot add yourself to your family') {
    super(message, 'FAMILY_SELF_NOT_ALLOWED', 400);
  }
}

export class FamilyTargetNotEligibleRoleError extends AppError {
  constructor(message: string = 'Only standard users can be added to a family') {
    super(message, 'FAMILY_TARGET_INVALID_ROLE', 400);
  }
}

export class FamilyTargetAlreadyInFamilyError extends AppError {
  constructor(message: string = 'This user is already a member of another family') {
    super(message, 'FAMILY_TARGET_ALREADY_MEMBER', 409);
  }
}

export class FamilyTargetIsHeadError extends AppError {
  constructor(message: string = 'This user already heads a family of their own') {
    super(message, 'FAMILY_TARGET_IS_HEAD', 409);
  }
}

export class FamilyInviterIsMemberError extends AppError {
  constructor(message: string = 'You are a member of another family and cannot add anyone') {
    super(message, 'FAMILY_INVITER_IS_MEMBER', 403);
  }
}

export class FamilyMaxMembersError extends AppError {
  constructor(message: string = 'Family already has the maximum number of members') {
    super(message, 'FAMILY_MAX_MEMBERS', 400);
  }
}

export class FamilyInvalidOtpError extends AppError {
  constructor(message: string = 'Invalid or expired family invitation OTP') {
    super(message, 'FAMILY_INVALID_OTP', 400);
  }
}

export class FamilyEmailSendFailedError extends AppError {
  constructor(message: string = 'Failed to send family invitation email') {
    super(message, 'FAMILY_EMAIL_FAILED', 500);
  }
}

export class FamilyNoPendingInviteError extends AppError {
  constructor(message: string = 'No pending family invitation found for this email') {
    super(message, 'FAMILY_NO_PENDING_INVITE', 404);
  }
}
