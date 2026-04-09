import mongoose, { Document, Schema } from 'mongoose';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export interface CustomerData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  landlineNumber?: string;
  countryCode: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  submittedAt: Date;
}

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  status: UserStatus;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  countryCode?: string;
  customerData?: CustomerData; // Keep for backward compatibility
  otp?: string;
  otpExpires?: Date;
  pendingUpdate?: any; // Temporary field for storing profile update data
  createdAt: Date;
  updatedAt: Date;
}

const customerDataSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  landlineNumber: { type: String },
  countryCode: { type: String, required: true },
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  status: { 
    type: String, 
    enum: Object.values(UserStatus), 
    default: UserStatus.INACTIVE 
  },
  role: { 
    type: String, 
    enum: Object.values(UserRole), 
    default: UserRole.USER 
  },
  firstName: { type: String },
  lastName: { type: String },
  phoneNumber: { type: String },
  countryCode: { type: String },
  customerData: { type: customerDataSchema },
  otp: { type: String },
  otpExpires: { type: Date }
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', userSchema);
