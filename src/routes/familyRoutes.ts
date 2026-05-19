import { Router } from 'express';
import { FamilyController } from '../controller/FamilyController';
import { authenticateToken, requireUser } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import {
  FamilySearchSchema,
  FamilyInviteSchema,
  FamilyVerifySchema,
} from '../validators/family.validator';

const router = Router();
const familyController = new FamilyController();

/**
 * @access private (user only)
 * @route GET /api/family
 * @desc Get the requesting user's family overview (role, members, discount)
 */
router.get(
  '/',
  authenticateToken,
  requireUser,
  rateLimiter({ max: 30 }),
  familyController.getFamily.bind(familyController),
);

/**
 * @access private (user only)
 * @route POST /api/family/search
 * @desc Check whether a given email is eligible to be added as family
 */
router.post(
  '/search',
  authenticateToken,
  requireUser,
  rateLimiter({ max: 20 }),
  validate(FamilySearchSchema),
  familyController.search.bind(familyController),
);

/**
 * @access private (user only)
 * @route POST /api/family/invite
 * @desc Send an OTP to the invitee's email with a chosen relation
 */
router.post(
  '/invite',
  authenticateToken,
  requireUser,
  rateLimiter({ max: 5 }),
  validate(FamilyInviteSchema),
  familyController.invite.bind(familyController),
);

/**
 * @access private (user only)
 * @route POST /api/family/verify
 * @desc Verify the OTP and permanently add the invitee
 */
router.post(
  '/verify',
  authenticateToken,
  requireUser,
  rateLimiter({ max: 5 }),
  validate(FamilyVerifySchema),
  familyController.verify.bind(familyController),
);

export default router;
