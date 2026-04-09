import { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { AddressRepository } from '../repository/AddressRepository';
import { AddressResponseDto } from '../dtos/address.dto';
import { logger } from '../utils/logger';

export class AddressController {
  private addressRepository: AddressRepository;

  constructor() {
    this.addressRepository = new AddressRepository();
  }

  // GET /api/addresses — list all addresses for logged-in user
  async getAddresses(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const addresses = await this.addressRepository.findByUserId(userId);

      const dtos = addresses.map(a =>
        plainToInstance(AddressResponseDto, a.toObject(), { excludeExtraneousValues: true })
      );

      res.status(200).json({
        success: true,
        code: 'ADDRESSES_RETRIEVED',
        message: 'Addresses retrieved successfully',
        data: { addresses: dtos }
      });
    } catch (error: any) {
      logger.error(req.user?.email || 'unknown', 'getAddresses', error.message);
      res.status(500).json({
        success: false,
        error: { code: 'GET_ADDRESSES_ERROR', message: 'Failed to retrieve addresses' }
      });
    }
  }

  // POST /api/addresses — add a new address
  async createAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const { street, city, state, postalCode, country, isDefault, addressType } = req.body;

      // If new address is default, unset all existing defaults first
      if (isDefault) {
        await this.addressRepository.unsetDefaultForUser(userId);
      }

      // If this is the user's first address, force it as default
      const count = await this.addressRepository.countByUserId(userId);
      const shouldBeDefault = isDefault || count === 0;

      if (shouldBeDefault && !isDefault) {
        await this.addressRepository.unsetDefaultForUser(userId);
      }

      const address = await this.addressRepository.create({
        userId,
        street,
        city,
        state,
        postalCode,
        country,
        isDefault: shouldBeDefault,
        addressType: addressType || 'home',
      });

      logger.success(req.user!.email, 'createAddress', `Address created: ${address._id}`);

      const dto = plainToInstance(AddressResponseDto, address.toObject(), { excludeExtraneousValues: true });

      res.status(201).json({
        success: true,
        code: 'ADDRESS_CREATED',
        message: 'Address created successfully',
        data: { address: dto }
      });
    } catch (error: any) {
      logger.error(req.user?.email || 'unknown', 'createAddress', error.message);
      res.status(500).json({
        success: false,
        error: { code: 'CREATE_ADDRESS_ERROR', message: 'Failed to create address' }
      });
    }
  }

  // PUT /api/addresses/:addressId — update an address
  async updateAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const addressId = req.params.addressId as string;

      const existing = await this.addressRepository.findById(addressId);
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found' }
        });
        return;
      }

      if (existing.userId !== userId) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this address' }
        });
        return;
      }

      const { street, city, state, postalCode, country, isDefault, addressType } = req.body;

      // If setting as default, unset all others first
      if (isDefault === true) {
        await this.addressRepository.unsetDefaultForUser(userId);
      }

      const updated = await this.addressRepository.updateById(addressId, {
        ...(street !== undefined && { street }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(postalCode !== undefined && { postalCode }),
        ...(country !== undefined && { country }),
        ...(isDefault !== undefined && { isDefault }),
        ...(addressType !== undefined && { addressType }),
      });

      logger.success(req.user!.email, 'updateAddress', `Address updated: ${addressId}`);

      const dto = plainToInstance(AddressResponseDto, updated!.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'ADDRESS_UPDATED',
        message: 'Address updated successfully',
        data: { address: dto }
      });
    } catch (error: any) {
      logger.error(req.user?.email || 'unknown', 'updateAddress', error.message);
      res.status(500).json({
        success: false,
        error: { code: 'UPDATE_ADDRESS_ERROR', message: 'Failed to update address' }
      });
    }
  }

  // DELETE /api/addresses/:addressId — delete an address
  async deleteAddress(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const addressId = req.params.addressId as string;

      const existing = await this.addressRepository.findById(addressId);
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found' }
        });
        return;
      }

      if (existing.userId !== userId) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this address' }
        });
        return;
      }

      const wasDefault = existing.isDefault;
      await this.addressRepository.deleteById(addressId);

      // If deleted address was default, promote the oldest remaining to default
      if (wasDefault) {
        const remaining = await this.addressRepository.findByUserId(userId);
        if (remaining.length > 0) {
          await this.addressRepository.updateById(remaining[0]._id.toString(), { isDefault: true });
        }
      }

      logger.success(req.user!.email, 'deleteAddress', `Address deleted: ${addressId}`);

      res.status(200).json({
        success: true,
        code: 'ADDRESS_DELETED',
        message: 'Address deleted successfully'
      });
    } catch (error: any) {
      logger.error(req.user?.email || 'unknown', 'deleteAddress', error.message);
      res.status(500).json({
        success: false,
        error: { code: 'DELETE_ADDRESS_ERROR', message: 'Failed to delete address' }
      });
    }
  }

  // PATCH /api/addresses/:addressId/set-default — set an address as default
  async setDefault(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!._id.toString();
      const addressId = req.params.addressId as string;

      const existing = await this.addressRepository.findById(addressId);
      if (!existing) {
        res.status(404).json({
          success: false,
          error: { code: 'ADDRESS_NOT_FOUND', message: 'Address not found' }
        });
        return;
      }

      if (existing.userId !== userId) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this address' }
        });
        return;
      }

      await this.addressRepository.unsetDefaultForUser(userId);
      const updated = await this.addressRepository.updateById(addressId, { isDefault: true });

      logger.success(req.user!.email, 'setDefault', `Default address set: ${addressId}`);

      const dto = plainToInstance(AddressResponseDto, updated!.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'DEFAULT_ADDRESS_SET',
        message: 'Default address updated successfully',
        data: { address: dto }
      });
    } catch (error: any) {
      logger.error(req.user?.email || 'unknown', 'setDefault', error.message);
      res.status(500).json({
        success: false,
        error: { code: 'SET_DEFAULT_ERROR', message: 'Failed to set default address' }
      });
    }
  }
}
