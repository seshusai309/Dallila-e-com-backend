import { Router } from 'express';
import { AddressController } from '../controller/AddressController';
import { authenticateToken, requireUser } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { CreateAddressSchema, UpdateAddressSchema } from '../validators/address.validator';

const router = Router();
const addressController = new AddressController();

/**
 * @access private (user only)
 * @route GET /api/addresses
 * @desc Get all addresses for logged-in user
 */
router.get(
  '/',
  authenticateToken,
  requireUser,
  rateLimiter({ max: 30 }),
  addressController.getAddresses.bind(addressController)
);

/**
 * @access private (user only)
 * @route POST /api/addresses
 * @desc Add a new address
 */
router.post(
  '/',
  authenticateToken,
  requireUser,
  rateLimiter({ max: 10 }),
  validate(CreateAddressSchema),
  addressController.createAddress.bind(addressController)
);

/**
 * @access private (user only)
 * @route PUT /api/addresses/:addressId
 * @desc Update an existing address
 */
router.put(
  '/:addressId',
  authenticateToken,
  requireUser,
  rateLimiter({ max: 10 }),
  validate(UpdateAddressSchema),
  addressController.updateAddress.bind(addressController)
);

/**
 * @access private (user only)
 * @route DELETE /api/addresses/:addressId
 * @desc Delete an address
 */
router.delete(
  '/:addressId',
  authenticateToken,
  requireUser,
  rateLimiter({ max: 10 }),
  addressController.deleteAddress.bind(addressController)
);

/**
 * @access private (user only)
 * @route PATCH /api/addresses/:addressId/set-default
 * @desc Set an address as the default
 */
router.patch(
  '/:addressId/set-default',
  authenticateToken,
  requireUser,
  rateLimiter({ max: 10 }),
  addressController.setDefault.bind(addressController)
);

export default router;
