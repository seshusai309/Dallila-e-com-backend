import { Expose, Transform } from 'class-transformer';
import { BaseDto } from './base.dto';

// Cart Item DTO
export class CartItemDto {
  @Expose()
  @Transform(({ obj }) => obj.productId?.toString())
  productId!: string;

  @Expose()
  variantId!: string;

  @Expose()
  variant_name!: string;

  @Expose()
  sku!: string;

  @Expose()
  title!: string;

  @Expose()
  price!: number;

  @Expose()
  quantity!: number;

  @Expose()
  thumbnail!: string;

  @Expose()
  addedAt!: Date;
}

// Cart Response DTO
export class CartResponseDto extends BaseDto {
  @Expose()
  @Transform(({ obj }) => obj.user?.toString())
  userId?: string;

  @Expose()
  items!: CartItemDto[];

  @Expose()
  isActive!: boolean;

  @Expose()
  get totalItems(): number {
    return this.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
  }

  @Expose()
  get totalAmount(): number {
    return this.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0;
  }
}

// Cart Stats DTO
export class CartStatsDto {
  @Expose()
  totalCarts!: number;

  @Expose()
  totalItems!: number;

  @Expose()
  totalValue!: number;
}
