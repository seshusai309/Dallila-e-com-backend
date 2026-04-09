import { Expose, Type } from 'class-transformer';
import { BaseDto } from './base.dto';

// ── Image DTO ────────────────────────────────────────────────────────────────
export class ProductImageDto {
  @Expose()
  _id!: string;

  @Expose()
  src!: string;

  @Expose()
  position!: number;
}

// ── Variant DTO ──────────────────────────────────────────────────────────────
export class ProductVariantDto {
  @Expose()
  _id!: string;

  @Expose()
  title!: string;

  @Expose()
  variant_name!: 'gold' | 'silver' | 'rose gold';

  @Expose()
  sku!: string;

  @Expose()
  stock!: number;

  @Expose()
  price!: number;

  @Expose()
  position!: number;

  @Expose()
  thumbnail!: string;

  @Expose()
  @Type(() => ProductImageDto)
  images!: ProductImageDto[];
}

// ── Options DTO ───────────────────────────────────────────────────────────────
export interface ProductOptionDto {
  name: string;
  values: string[];
}

// ── Product Response DTO ─────────────────────────────────────────────────────
export class ProductResponseDto extends BaseDto {
  @Expose()
  title!: string;

  @Expose()
  slug!: string;

  @Expose()
  description!: string;

  @Expose()
  tags!: string[];

  @Expose()
  vendor!: string;

  @Expose()
  rating!: number;

  @Expose()
  reviews_count!: number;

  @Expose()
  is_featured!: boolean;

  @Expose()
  category!: string;

  @Expose()
  stoneType!: string;

  @Expose()
  color!: string;

  @Expose()
  shape!: string;

  @Expose()
  carat!: number;

  @Expose()
  origin!: string;

  @Expose()
  treatment!: string;

  @Expose()
  availability!: boolean;

  @Expose()
  certificate!: string;

  @Expose()
  measurement!: string;

  @Expose()
  details!: string;

  @Expose()
  videoUrls?: string[];

  @Expose()
  certificateUrls?: string[];

  @Expose()
  diamondPcs!: number;

  @Expose()
  @Type(() => ProductVariantDto)
  variants!: ProductVariantDto[];

  @Expose()
  options?: ProductOptionDto[];
}

// ── Product List DTOs (slim, for GET /products) ──────────────────────────────
export interface ProductListVariantDto {
  id: string;
  title: string;
  price: number;
  available: boolean;
  position: number;
  thumbnail: string;
  previewImage: string;
}

export interface ProductListItemDto {
  id: string;
  slug: string;
  title: string;
  vendor: string;
  rating: number;
  reviews_count: number;
  tags: string[];
  availability: boolean;
  variants: ProductListVariantDto[];
  minPrice: number;
  options?: ProductOptionDto[];
}

// ── Category DTO ─────────────────────────────────────────────────────────────
export class CategoryDto {
  @Expose()
  name!: string;

  @Expose()
  count!: number;
}

// ── Stats DTO ────────────────────────────────────────────────────────────────
export class ProductStatsDto {
  @Expose()
  totalProducts!: number;

  @Expose()
  totalCategories!: number;

  @Expose()
  averagePrice!: number;

  @Expose()
  lowStockProducts!: number;
}
