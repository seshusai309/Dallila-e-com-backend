import mongoose, { Schema, Document } from 'mongoose';

export interface IAddress extends Document {
  userId: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  addressType: 'home' | 'work' | 'billing' | 'shipping';
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    userId: { type: String, required: true, index: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    addressType: {
      type: String,
      enum: ['home', 'work', 'billing', 'shipping'],
      default: 'home',
    },
  },
  { timestamps: true }
);

export const AddressModel = mongoose.model<IAddress>('Address', addressSchema);
