import { Router } from 'express';
import { UserController } from '../controller/UserController';
import { AdminController } from '../controller/AdminController';
import { authenticateToken, requireSuperAdmin, requireAdmin , requireUser} from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { 
  RegisterUserSchema, 
  LoginSchema, 
  SendOtpSchema, 
  VerifyOtpSchema, 
  ResetPasswordSchema,
  UpdateProfileSchema,
  AdminCreateSchema,
  AdminUpdateUserSchema
} from '../validators/user.validator';

const router = Router();
const userController = new UserController();
const adminController = new AdminController();

/**
 * @access public
 * @route POST /register
 * @desc Register a new user
 */
router.post(
  '/register',
  rateLimiter({ max: 15 }),
  validate(RegisterUserSchema),
  userController.register.bind(userController)
);


/**
 * @access public
 * @route POST /login
 * @desc Login user with email and password
 */
router.post(
  '/login',
  rateLimiter({ max: 15 }),
  validate(LoginSchema),
  userController.login.bind(userController)
);


/**
 * @access private (authenticated users)
 * @route POST /logout
 * @desc Logout user and clear session
 */
router.post(
  '/logout',
  authenticateToken,
  rateLimiter({ max: 10 }),
  userController.logout.bind(userController)
);


/**
 * @access public
 * @route POST /send-otp
 * @desc Send OTP for registration, password reset, or profile update
 */
router.post(
  '/send-otp',
  rateLimiter({ max: 3 }),
  validate(SendOtpSchema),
  userController.sendOtp.bind(userController)
);


/**
 * @access public
 * @route POST /verify-otp
 * @desc Verify OTP and activate account
 */
router.post(
  '/verify-otp',
  rateLimiter({ max: 5 }),
  validate(VerifyOtpSchema),
  userController.verifyOtp.bind(userController)
);


/**
 * @access public
 * @route POST /reset-password
 * @desc Reset password using OTP
 */
router.post(
  '/reset-password',
  rateLimiter({ max: 3 }),
  validate(ResetPasswordSchema),
  userController.resetPassword.bind(userController)
);


/**
 * @access private (user only)
 * @route POST /update-profile
 * @desc Update user profile with OTP verification
 */
router.post(
  '/update-profile',
  authenticateToken,
  requireUser,
  rateLimiter({ max: 5 }),
  validate(UpdateProfileSchema),
  userController.updateProfile.bind(userController)
);


/**
 * @access private (authenticated users)
 * @route GET /profile
 * @desc Get current user profile
 */
router.get(
  '/profile',
  authenticateToken,
  rateLimiter({ max: 30 }),
  userController.getProfile.bind(userController)
);


/**
 * @access private (admin only)
 * @route GET /
 * @desc Get all users (USER role only)
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 30 }),
  adminController.getAllUsers.bind(adminController)
);


/**
 * @access private (admin only)
 * @route GET /:id
 * @desc Get user by ID
 */
router.get(
  '/:id',
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 30 }),
  adminController.getUserById.bind(adminController)
);


/**
 * @access private (admin only)
 * @route PUT /:id
 * @desc Update user by ID
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 10 }),
  validate(AdminUpdateUserSchema),
  adminController.updateUser.bind(adminController)
);


/**
 * @access private (admin only)
 * @route DELETE /:id
 * @desc Delete user by ID
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 10 }),
  adminController.deleteUser.bind(adminController)
);


/**
 * @access private (super admin only)
 * @route POST /admin/create
 * @desc Create a new admin user
 */
router.post(
  '/admin/create',
  authenticateToken,
  requireSuperAdmin,
  rateLimiter({ max: 5 }),
  validate(AdminCreateSchema),
  adminController.createAdmin.bind(adminController)
);


/**
 * @access private (super admin only)
 * @route GET /admin/list
 * @desc Get list of all admin users
 */
router.get(
  '/admin/list',
  authenticateToken,
  requireSuperAdmin,
  rateLimiter({ max: 30 }),
  adminController.getAdminsList.bind(adminController)
);


/**
 * @access private (super admin only)
 * @route GET /admin/:id
 * @desc Get admin by ID
 */
router.get(
  '/admin/:id',
  authenticateToken,
  requireSuperAdmin,
  rateLimiter({ max: 30 }),
  adminController.getAdminById.bind(adminController)
);

/**
 * @access private (super admin only)
 * @route PUT /admin/:id
 * @desc Update admin user by ID
 */
router.put(
  '/admin/:id',
  authenticateToken,
  requireSuperAdmin,
  rateLimiter({ max: 10 }),
  validate(AdminUpdateUserSchema),
  adminController.updateAdminUser.bind(adminController)
);

/**
 * @access private (super admin only)
 * @route DELETE /admin/:id
 * @desc Delete admin user by ID
 */
router.delete(
  '/admin/:id',
  authenticateToken,
  requireSuperAdmin,
  rateLimiter({ max: 10 }),
  adminController.deleteAdminUser.bind(adminController)
);


export default router;
