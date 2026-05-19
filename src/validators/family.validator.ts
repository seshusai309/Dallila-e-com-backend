import { z } from 'zod';
import { FamilyRelation } from '../models/FamilyMember';

export const FamilySearchSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
});

export const FamilyInviteSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  relation: z.enum(Object.values(FamilyRelation) as [string, ...string[]]),
});

export const FamilyVerifySchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase()),
  otp: z.string().min(4, 'OTP is required'),
});

export type FamilySearchInput = z.infer<typeof FamilySearchSchema>;
export type FamilyInviteInput = z.infer<typeof FamilyInviteSchema>;
export type FamilyVerifyInput = z.infer<typeof FamilyVerifySchema>;
