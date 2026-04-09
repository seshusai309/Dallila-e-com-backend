import { Expose, Transform } from 'class-transformer';
import { BaseDto } from './base.dto';

// Wishlist Item DTO
export class WishlistItemDto {
  @Expose()
  @Transform(({ obj }) => obj.productId?.toString())
  productId!: string;

  @Expose()
  title!: string;

  @Expose()
  price!: number;

  @Expose()
  thumbnail!: string;

  @Expose()
  addedAt!: Date;
}

// User Details DTO
export class UserDetailsDto {
  @Expose()
  userName!: string;

  @Expose()
  userEmail!: string;
}

// Wishlist Response DTO
export class WishlistResponseDto extends BaseDto {
  @Expose()
  @Transform(({ obj }) => obj.user?.toString())
  userId!: string;

  @Expose()
  items!: WishlistItemDto[];

  @Expose()
  isActive!: boolean;

  @Expose()
  userDetails?: UserDetailsDto;

  @Expose()
  get totalItems(): number {
    return this.items?.length || 0;
  }
}

// Wishlist Stats DTO
export class WishlistStatsDto {
  @Expose()
  totalItems!: number;

  @Expose()
  totalValue!: number;

  @Expose()
  userDetails?: UserDetailsDto;
}
