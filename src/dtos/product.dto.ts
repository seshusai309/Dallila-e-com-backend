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
  sku!: string;

  @Expose()
  price!: number;

  @Expose()
  stock!: number;

  @Expose()
  thumbnail?: string;

  @Expose()
  @Type(() => ProductImageDto)
  images!: ProductImageDto[];
}

// ── Product List DTOs (slim, for GET /products) ──────────────────────────────
export interface ProductListItemDto {
  id: string;
  slug: string;
  title: string;
  vendor: string;
  rating: number;
  reviews_count: number;
  tags: string[];
  availability: boolean;
  available: boolean;
  sku: string;
  price: number;
  stock: number;
  thumbnail: string;
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
