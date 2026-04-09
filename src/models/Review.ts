import mongoose, { Schema, Document } from 'mongoose';

export interface Review extends Document {
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  reviewerName: string;
  reviewerEmail: string;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<Review>({
  productId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Product', 
    required: true 
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  rating: { 
    type: Number, 
    required: true,
    min: 1,
    max: 5
  },
  comment: { 
    type: String, 
    required: true,
    minlength: 1,
    maxlength: 1000
  },
  reviewerName: { 
    type: String, 
    required: true 
  },
  reviewerEmail: { 
    type: String, 
    required: true 
  },
  helpfulCount: { 
    type: Number, 
    default: 0,
    min: 0
  }
}, { 
  timestamps: true 
});

// Indexes for better query performance
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, productId: 1 });
reviewSchema.index({ rating: 1 });

export const ReviewModel = mongoose.model<Review>('Review', reviewSchema);
