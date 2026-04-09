import mongoose, { Schema, Document } from 'mongoose';

export interface WishlistItem {
  productId: string; // MongoDB _id
  title: string;
  price: number;
  thumbnail: string;
  addedAt: Date;
}

export interface Wishlist extends Document {
  userId: string; // Required for logged-in users only
  items: WishlistItem[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const wishlistItemSchema = new Schema({
  productId: { type: String, required: true }, // MongoDB _id
  title: { type: String, required: true },
  price: { type: Number, required: true },
  thumbnail: { type: String, required: true },
  addedAt: { type: Date, default: Date.now }
}, { _id: false });

const wishlistSchema = new Schema<Wishlist>({
  userId: { type: String, required: true }, // Required for logged-in users only
  items: [wishlistItemSchema],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for efficient lookups
wishlistSchema.index({ userId: 1, isActive: 1 });

export const WishlistModel = mongoose.model<Wishlist>('Wishlist', wishlistSchema);
