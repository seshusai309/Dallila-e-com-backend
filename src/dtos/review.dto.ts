import { Expose, Transform } from 'class-transformer';
import { BaseDto } from './base.dto';

// Review Response DTO
export class ReviewResponseDto extends BaseDto {
  @Expose()
  @Transform(({ obj }) => obj.productId?.toString())
  productId!: string;

  @Expose()
  userId!: string;

  @Expose()
  rating!: number;

  @Expose()
  comment!: string;

  @Expose()
  reviewerName!: string;

  @Expose()
  reviewerEmail!: string;

  @Expose()
  helpfulCount!: number;
}

// Review with populated data DTO
export class ReviewWithDetailsDto extends BaseDto {
  @Expose()
  @Transform(({ obj }) => {
    // Handle both populated product object and string productId
    if (typeof obj.productId === 'object' && obj.productId._id) {
      return obj.productId._id.toString();
    }
    return obj.productId?.toString();
  })
  productId!: string;

  @Expose()
  @Transform(({ obj }) => {
    // Handle populated product object
    if (typeof obj.productId === 'object' && obj.productId.title) {
      return obj.productId.title;
    }
    return undefined;
  })
  productName?: string;

  @Expose()
  @Transform(({ obj }) => {
    // Handle both populated user object and string userId
    if (typeof obj.userId === 'object' && obj.userId._id) {
      return obj.userId._id.toString();
    }
    return obj.userId?.toString();
  })
  userId!: string;

  @Expose()
  @Transform(({ obj }) => {
    // Handle populated user object
    if (typeof obj.userId === 'object' && obj.userId.username) {
      return obj.userId.username;
    }
    return undefined;
  })
  username?: string;

  @Expose()
  @Transform(({ obj }) => {
    // Handle populated user object
    if (typeof obj.userId === 'object' && obj.userId.email) {
      return obj.userId.email;
    }
    return undefined;
  })
  userEmail?: string;

  @Expose()
  rating!: number;

  @Expose()
  comment!: string;

  @Expose()
  reviewerName!: string;

  @Expose()
  reviewerEmail!: string;

  @Expose()
  helpfulCount!: number;

  @Expose()
  isEditable!: boolean;
}

// Review List Response DTO
export class ReviewListResponseDto {
  @Expose()
  reviews!: ReviewWithDetailsDto[];

  @Expose()
  pagination!: {
    current: number;
    total: number;
    limit: number;
    totalReviews: number;
  };
}

// Review Stats Response DTO
export class ReviewStatsResponseDto {
  @Expose()
  averageRating!: number;

  @Expose()
  totalReviews!: number;

  @Expose()
  ratingDistribution!: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}
