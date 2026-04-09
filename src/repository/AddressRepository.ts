import { AddressModel, IAddress } from '../models/Address';

export class AddressRepository {
  async create(data: Partial<IAddress>): Promise<IAddress> {
    const address = new AddressModel(data);
    return await address.save();
  }

  async findById(addressId: string): Promise<IAddress | null> {
    return await AddressModel.findById(addressId);
  }

  async findByUserId(userId: string): Promise<IAddress[]> {
    return await AddressModel.find({ userId }).sort({ createdAt: 1 });
  }

  async findDefaultByUserId(userId: string): Promise<IAddress | null> {
    return await AddressModel.findOne({ userId, isDefault: true });
  }

  async updateById(addressId: string, data: Partial<IAddress>): Promise<IAddress | null> {
    return await AddressModel.findByIdAndUpdate(addressId, data, { new: true });
  }

  async unsetDefaultForUser(userId: string): Promise<void> {
    await AddressModel.updateMany({ userId, isDefault: true }, { isDefault: false });
  }

  async deleteById(addressId: string): Promise<boolean> {
    const result = await AddressModel.findByIdAndDelete(addressId);
    return result !== null;
  }

  async countByUserId(userId: string): Promise<number> {
    return await AddressModel.countDocuments({ userId });
  }
}
