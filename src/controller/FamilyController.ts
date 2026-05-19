import { Request, Response } from 'express';
import { FamilyService } from '../services/family.service';
import { FamilyRelation } from '../models/FamilyMember';
import { AppError } from '../utils/errors/app.error';
import { logger } from '../utils/logger';

export class FamilyController {
  private familyService: FamilyService;

  constructor() {
    this.familyService = new FamilyService();
  }

  private handleError(req: Request, res: Response, op: string, error: any): void {
    logger.error(req.user?.email || 'anonymous', `family.${op}`, error.message);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        error: { code: error.code, message: error.message },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: { code: 'FAMILY_ERROR', message: 'Family operation failed. Please try again.' },
    });
  }

  /**
   * GET /api/family
   */
  async getFamily(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const data = await this.familyService.getFamily(user._id.toString());
      res.status(200).json({
        success: true,
        code: 'FAMILY_RETRIEVED',
        message: 'Family retrieved successfully',
        data,
      });
    } catch (error: any) {
      this.handleError(req, res, 'getFamily', error);
    }
  }

  /**
   * POST /api/family/search
   * Body: { email }
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { email } = req.body;
      const result = await this.familyService.checkEligibility(user._id.toString(), email);
      res.status(200).json({
        success: true,
        code: 'FAMILY_TARGET_ELIGIBLE',
        message: 'User is eligible to be added',
        data: { email: result.targetEmail },
      });
    } catch (error: any) {
      this.handleError(req, res, 'search', error);
    }
  }

  /**
   * POST /api/family/invite
   * Body: { email, relation }
   */
  async invite(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { email, relation } = req.body;
      const result = await this.familyService.sendInvite(
        user._id.toString(),
        email,
        relation as FamilyRelation,
      );
      res.status(200).json({
        success: true,
        code: 'FAMILY_INVITE_SENT',
        message: 'Family invitation OTP sent to the invitee',
        data: result,
      });
    } catch (error: any) {
      this.handleError(req, res, 'invite', error);
    }
  }

  /**
   * POST /api/family/verify
   * Body: { email, otp }
   */
  async verify(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { email, otp } = req.body;
      const data = await this.familyService.verifyAndAdd(user._id.toString(), email, otp);
      res.status(200).json({
        success: true,
        code: 'FAMILY_MEMBER_ADDED',
        message: 'Family member added successfully',
        data,
      });
    } catch (error: any) {
      this.handleError(req, res, 'verify', error);
    }
  }
}
