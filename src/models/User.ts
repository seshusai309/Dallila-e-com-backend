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
  discountPercent: number; // Family discount: starts at 5, +2 per added member (max 13)
  familyHeadId?: mongoose.Types.ObjectId; // Set if this user is a member of someone else's family
  familyInviteOtp?: string; // OTP for pending family invitation accepted via THIS user's email
  familyInviteOtpExpires?: Date;
  familyInviteInviterId?: mongoose.Types.ObjectId; // The head who sent the pending invite
  familyInviteRelation?: string; // Relation chosen by inviter for pending invite
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
  otpExpires: { type: Date },
  discountPercent: { type: Number, default: 5, min: 0, max: 13 },
  familyHeadId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  familyInviteOtp: { type: String },
  familyInviteOtpExpires: { type: Date },
  familyInviteInviterId: { type: Schema.Types.ObjectId, ref: 'User' },
  familyInviteRelation: { type: String }
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', userSchema);
