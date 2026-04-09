import mongoose, { Schema, Document } from 'mongoose';

export interface CartItem {
  productId: string; // MongoDB _id
  variantId: string; // Variant _id
  variant_name: 'gold' | 'silver' | 'rose gold';
  sku: string;
  title: string;
  price: number;
  quantity: number;
  thumbnail?: string;
  addedAt: Date;
}

export interface Cart extends Document {
  userId?: string | null; // Allow null for guests
  items: CartItem[];
  totalAmount: number;
  totalItems: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema({
  productId: { type: String, required: true }, // MongoDB _id
  variantId: { type: String, required: true }, // Variant _id
  variant_name: { type: String, required: true, enum: ['gold', 'silver', 'rose gold'] },
  sku: { type: String, required: true },
  title: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  thumbnail: { type: String },
  addedAt: { type: Date, default: Date.now }
}, { _id: false });

const cartSchema = new Schema<Cart>({
  userId: { type: String, default: null, sparse: true }, // Default null for guests
  items: [cartItemSchema],
  totalAmount: { type: Number, default: 0 },
  totalItems: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for efficient lookups
cartSchema.index({ userId: 1, isActive: 1 });

export const CartModel = mongoose.model<Cart>('Cart', cartSchema);
