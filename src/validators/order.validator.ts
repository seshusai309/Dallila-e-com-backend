import { z } from 'zod';

// Create Order validation schema
export const CreateOrderSchema = z.object({
  addressId: z.string().optional(),
  paymentMethod: z.enum(['ONLINE', 'COD'], {
    message: 'Payment method must be ONLINE or COD',
  }),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
});

// Update Order Status validation schema
export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'], {
    message: 'Must be one of: PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED',
  }),
});

// Verify Delivery OTP validation schema
export const VerifyDeliveryOtpSchema = z.object({
  otp: z.string().min(1, 'OTP is required'),
});

// Ship Order with OTP validation schema
export const ShipOrderSchema = z.object({
  trackingNumber: z.string().optional(),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type VerifyDeliveryOtpInput = z.infer<typeof VerifyDeliveryOtpSchema>;
export type ShipOrderInput = z.infer<typeof ShipOrderSchema>;
