import { FamilyRepository } from '../repository/FamilyRepository';
import { UserRepository } from '../repository/UserRepository';
import { User, IUser, UserRole } from '../models/User';
import {
  FamilyMember,
  FamilyRelation,
  FAMILY_MAX_MEMBERS,
  FAMILY_BASE_DISCOUNT,
  FAMILY_PER_MEMBER_BONUS,
} from '../models/FamilyMember';
import {
  FamilyTargetNotFoundError,
  FamilyCannotAddSelfError,
  FamilyTargetNotEligibleRoleError,
  FamilyTargetAlreadyInFamilyError,
  FamilyTargetIsHeadError,
  FamilyInviterIsMemberError,
  FamilyMaxMembersError,
  FamilyInvalidOtpError,
  FamilyEmailSendFailedError,
  FamilyNoPendingInviteError,
} from '../utils/errors/family.errors';
import { emailService } from '../utils/emailService';
import { logger } from '../utils/logger';

export interface FamilyOverview {
  role: 'head' | 'member' | 'none';
  discountPercent: number;
  memberCount: number;
  maxMembers: number;
  canAddMore: boolean;
  members?: Array<{
    _id: string;
    memberUserId: string;
    email: string;
    relation: FamilyRelation;
    addedAt: Date;
  }>;
  head?: {
    _id: string;
    email: string;
    username?: string;
  };
  relationToHead?: string;
}

export class FamilyService {
  private familyRepository: FamilyRepository;
  private userRepository: UserRepository;

  constructor() {
    this.familyRepository = new FamilyRepository();
    this.userRepository = new UserRepository();
  }

  /**
   * Get family overview for the requesting user
   */
  async getFamily(userId: string): Promise<FamilyOverview> {
    // Is the user a member of someone else's family?
    const membership = await this.familyRepository.findByMemberId(userId);
    if (membership) {
      const head = membership.headUserId as any; // populated
      const me = await this.userRepository.findById(userId);
      return {
        role: 'member',
        discountPercent: me?.discountPercent ?? FAMILY_BASE_DISCOUNT,
        memberCount: 0,
        maxMembers: FAMILY_MAX_MEMBERS,
        canAddMore: false,
        head: {
          _id: head._id.toString(),
          email: head.email,
          username: head.username,
        },
        relationToHead: membership.relation,
      };
    }

    // Otherwise user is a head (or has no family yet)
    const members = await this.familyRepository.findByHeadId(userId);
    const me = await this.userRepository.findById(userId);

    return {
      role: members.length > 0 ? 'head' : 'none',
      discountPercent: me?.discountPercent ?? FAMILY_BASE_DISCOUNT,
      memberCount: members.length,
      maxMembers: FAMILY_MAX_MEMBERS,
      canAddMore: members.length < FAMILY_MAX_MEMBERS,
      members: members.map((m) => {
        const populated = m.memberUserId as any;
        return {
          _id: m._id.toString(),
          memberUserId: populated._id.toString(),
          email: populated.email,
          relation: m.relation,
          addedAt: m.addedAt,
        };
      }),
    };
  }

  /**
   * Verify eligibility for adding a member. Used both by /search and as a
   * guard inside /invite to avoid wasting OTPs on invalid targets.
   */
  async checkEligibility(
    inviterId: string,
    targetEmail: string,
  ): Promise<{ targetUserId: string; targetEmail: string }> {
    // Inviter must not be a member of someone else's family
    const inviterMembership = await this.familyRepository.findByMemberId(inviterId);
    if (inviterMembership) {
      throw new FamilyInviterIsMemberError();
    }

    // Inviter cannot exceed cap
    const currentCount = await this.familyRepository.countByHeadId(inviterId);
    if (currentCount >= FAMILY_MAX_MEMBERS) {
      throw new FamilyMaxMembersError();
    }

    // Target must exist
    const target = await this.userRepository.findByEmail(targetEmail);
    if (!target) {
      throw new FamilyTargetNotFoundError();
    }

    // Cannot add self
    if (target._id.toString() === inviterId) {
      throw new FamilyCannotAddSelfError();
    }

    // Only USER role allowed
    if (target.role !== UserRole.USER) {
      throw new FamilyTargetNotEligibleRoleError();
    }

    // Target must not already be a member of any family
    const alreadyMember = await this.familyRepository.existsForMember(target._id.toString());
    if (alreadyMember) {
      throw new FamilyTargetAlreadyInFamilyError();
    }

    // Target must not themselves head a family (mutual exclusivity)
    const targetHeadsCount = await this.familyRepository.countByHeadId(target._id.toString());
    if (targetHeadsCount > 0) {
      throw new FamilyTargetIsHeadError();
    }

    return { targetUserId: target._id.toString(), targetEmail: target.email };
  }

  /**
   * Send an OTP to the invitee. Stores pending invite on the target user.
   */
  async sendInvite(
    inviterId: string,
    targetEmail: string,
    relation: FamilyRelation,
  ): Promise<{ targetEmail: string; otpExpiry: Date }> {
    const normalizedEmail = targetEmail.toLowerCase();
    const { targetUserId } = await this.checkEligibility(inviterId, normalizedEmail);

    const inviter = await this.userRepository.findById(inviterId);
    if (!inviter) throw new FamilyTargetNotFoundError('Inviter not found');

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.findByIdAndUpdate(targetUserId, {
      familyInviteOtp: otp,
      familyInviteOtpExpires: otpExpires,
      familyInviteInviterId: inviterId,
      familyInviteRelation: relation,
    });

    const inviterName =
      [inviter.firstName, inviter.lastName].filter(Boolean).join(' ') ||
      inviter.username ||
      inviter.email;

    const emailSent = await emailService.sendFamilyInvitationOTP(
      normalizedEmail,
      otp,
      inviterName,
      inviter.email,
      relation,
    );

    if (!emailSent) {
      throw new FamilyEmailSendFailedError();
    }

    logger.success(inviter.email, 'family.sendInvite', `Family invite sent to ${normalizedEmail} as ${relation}`);

    return { targetEmail: normalizedEmail, otpExpiry: otpExpires };
  }

  /**
   * Verify the OTP and permanently add the invitee to the inviter's family.
   * Bumps inviter's discount by +FAMILY_PER_MEMBER_BONUS.
   */
  async verifyAndAdd(
    inviterId: string,
    targetEmail: string,
    otp: string,
  ): Promise<FamilyOverview> {
    const normalizedEmail = targetEmail.toLowerCase();

    const target = await this.userRepository.findByEmail(normalizedEmail);
    if (!target) {
      throw new FamilyTargetNotFoundError();
    }

    if (
      !target.familyInviteOtp ||
      !target.familyInviteInviterId ||
      target.familyInviteOtp !== otp
    ) {
      throw new FamilyInvalidOtpError();
    }

    if (target.familyInviteInviterId.toString() !== inviterId) {
      throw new FamilyNoPendingInviteError();
    }

    if (!target.familyInviteOtpExpires || target.familyInviteOtpExpires < new Date()) {
      throw new FamilyInvalidOtpError('Family invitation OTP has expired');
    }

    // Re-check eligibility at the moment of verification — target may have been
    // added to another family between invite-send and verify.
    await this.checkEligibility(inviterId, normalizedEmail);

    const relation = (target.familyInviteRelation as FamilyRelation) || FamilyRelation.OTHER;

    // Create membership
    await this.familyRepository.create({
      headUserId: inviterId,
      memberUserId: target._id.toString(),
      memberEmail: target.email,
      relation,
    });

    // Bump head's discount and stamp member's familyHeadId
    const inviter = await this.userRepository.findById(inviterId);
    const currentDiscount = inviter?.discountPercent ?? FAMILY_BASE_DISCOUNT;
    const newDiscount = Math.min(
      currentDiscount + FAMILY_PER_MEMBER_BONUS,
      FAMILY_BASE_DISCOUNT + FAMILY_MAX_MEMBERS * FAMILY_PER_MEMBER_BONUS,
    );
    await User.findByIdAndUpdate(inviterId, { discountPercent: newDiscount });

    // Clear pending invite and mark member's familyHeadId
    await User.findByIdAndUpdate(target._id, {
      familyHeadId: inviterId,
      $unset: {
        familyInviteOtp: 1,
        familyInviteOtpExpires: 1,
        familyInviteInviterId: 1,
        familyInviteRelation: 1,
      },
    });

    logger.success(
      inviter?.email || 'system',
      'family.verifyAndAdd',
      `Added ${target.email} as ${relation}; head discount now ${newDiscount}%`,
    );

    return this.getFamily(inviterId);
  }
}
