import mongoose, { Schema, Document } from 'mongoose';

export interface OrderItem {
  productId: string; // MongoDB _id
  sku: string;
  title: string;
  price: number;
  quantity: number;
  thumbnail?: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface Order extends Document {
  userId: string; // Required for logged-in users
  items: OrderItem[];
  totalAmount: number;
  totalItems: number;
  shippingAddress: ShippingAddress;
  paymentMethod: "ONLINE" | "COD";
  paymentStatus: "PENDING" | "PROCESSING" | "PAID" | "REFUNDED";
  orderStatus: "PENDING" | "CONFIRMED" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  sessionId?: string; // For Stripe Checkout Session integration
  sessionExpiresAt?: Date; // Stripe checkout session expiration time
  transactionId?: string; // For payment tracking
  orderNumber: string; // Unique order identifier
  deliveryOtp?: string; // OTP for delivery confirmation
  deliveryOtpExpires?: Date; // OTP expiration (24 hours)
  paidAt?: Date; // When payment was completed
  cancellationReason?: string;
  refundStatus: "NONE" | "REQUESTED" | "INITIATED" | "COMPLETED" | "FAILED";
  refundId?: string; // Stripe refund ID
  refundAmount?: number;
  refundedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema({
  productId: { type: String, required: true }, // MongoDB _id
  sku: { type: String, required: true },
  title: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  thumbnail: { type: String }
}, { _id: false });

const shippingAddressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
  isDefault: { type: Boolean, default: false }
}, { _id: false });

const orderSchema = new Schema<Order>({
  userId: { type: String, required: true }, // Required for logged-in users only
  items: [orderItemSchema],
  totalAmount: { type: Number, required: true },
  totalItems: { type: Number, required: true },
  shippingAddress: { type: shippingAddressSchema, required: true },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["ONLINE", "COD"]
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ["PENDING", "PROCESSING", "PAID", "REFUNDED"],
    default: "PENDING"
  },
  orderStatus: {
    type: String,
    required: true,
    enum: ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"],
    default: "PENDING"
  },
  sessionId: { type: String }, // For Stripe Checkout Session integration
  sessionExpiresAt: { type: Date }, // Stripe checkout session expiration time
  transactionId: { type: String }, // For payment tracking
  orderNumber: { type: String, required: true, unique: true }, // Unique order identifier
  deliveryOtp: { type: String }, // OTP for delivery confirmation
  deliveryOtpExpires: { type: Date }, // OTP expiration (24 hours)
  paidAt: { type: Date }, // When payment was completed
  cancellationReason: { type: String },
  refundStatus: {
    type: String,
    enum: ["NONE", "REQUESTED", "INITIATED", "COMPLETED", "FAILED"],
    default: "NONE"
  },
  refundId: { type: String },
  refundAmount: { type: Number },
  refundedAt: { type: Date },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for efficient lookups
orderSchema.index({ userId: 1, isActive: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ paymentStatus: 1 });

// Generate unique order number before saving
orderSchema.pre('validate', function() {
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.orderNumber = `ORD${timestamp}${random}`;
  }
});

export const OrderModel = mongoose.model<Order>('Order', orderSchema);
