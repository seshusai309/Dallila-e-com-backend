import mongoose, { Document, Schema } from 'mongoose';

export const FAMILY_MAX_MEMBERS = 4;
export const FAMILY_BASE_DISCOUNT = 5;
export const FAMILY_PER_MEMBER_BONUS = 2;

export enum FamilyRelation {
  MOTHER = 'mother',
  FATHER = 'father',
  SISTER = 'sister',
  BROTHER = 'brother',
  SPOUSE = 'spouse',
  CHILD = 'child',
  OTHER = 'other'
}

export interface IFamilyMember extends Document {
  headUserId: mongoose.Types.ObjectId;
  memberUserId: mongoose.Types.ObjectId;
  memberEmail: string;
  relation: FamilyRelation;
  addedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const familyMemberSchema = new Schema<IFamilyMember>({
  headUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  memberUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  memberEmail: { type: String, required: true },
  relation: { type: String, enum: Object.values(FamilyRelation), required: true },
  addedAt: { type: Date, default: Date.now }
}, { timestamps: true });

export const FamilyMember = mongoose.model<IFamilyMember>('FamilyMember', familyMemberSchema);
