import mongoose from 'mongoose';
import { ProductRepository } from '../repository/ProductRepository';
import { DummyProductService as DummyProductIntegration } from '../integrations/DummyProductService';
import { S3Service } from '../integrations/s3.service';
import { Product } from '../models/Product';
import { ProductNotFoundError, InvalidProductDataError, ImageMappingError } from '../utils/errors/product.errors';
import { logger } from '../utils/logger';

// ── Input types ──────────────────────────────────────────────────────────────

export interface CreateProductInput {
  title: string;
  description: string;
  vendor: string;
  category: string;
  stoneType: string;
  color: string;
  shape: string;
  carat: number;
  origin: string;
  treatment: string;
  certificate: string;
  measurement: string;
  details: string;
  sku: string;
  price: number;
  stock?: number;
  diamondPcs?: number;
  availability?: boolean;
  is_featured?: boolean;
  tags?: string[];
  videoUrls?: string[];
  certificateUrls?: string[];
  // imageMapping is a flat array of file indices to include as product images
  imageMapping?: number[];
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  vendor?: string;
  category?: string;
  stoneType?: string;
  color?: string;
  shape?: string;
  carat?: number;
  origin?: string;
  treatment?: string;
  certificate?: string;
  measurement?: string;
  details?: string;
  sku?: string;
  price?: number;
  stock?: number;
  diamondPcs?: number;
  availability?: boolean;
  is_featured?: boolean;
  tags?: string[];
  videoUrls?: string[];
  certificateUrls?: string[];
  imageMapping?: number[];
  delImgMapping?: number[];
}

export interface BulkUpdateResult {
  updated: number;
  failed: number;
  details?: any[];
}

export interface ProductStats {
  totalProducts: number;
  totalCategories: number;
  categories: string[];
}

// ── Service ──────────────────────────────────────────────────────────────────

export class ProductService {
  private productRepository: ProductRepository;
  private dummyProductService: DummyProductIntegration;
  private s3Service: S3Service;

  constructor() {
    this.productRepository = new ProductRepository();
    this.dummyProductService = new DummyProductIntegration();
    this.s3Service = new S3Service();
  }

  // ── Category helpers ───────────────────────────────────────────────────────

  private normalizeCategory(category: string): string {
    if (!category || typeof category !== 'string') return category;
    const trimmed = category.trim();
    if (trimmed.length === 0) return trimmed;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }

  private async findExistingCategory(categoryName: string): Promise<string | null> {
    const categories = await this.productRepository.getCategories();
    const normalizedInput = categoryName.toLowerCase().trim();
    for (const existing of categories) {
      if (existing.toLowerCase().trim() === normalizedInput) return existing;
    }
    return null;
  }

  private async normalizeOrFindCategory(category: string): Promise<string> {
    if (!category || typeof category !== 'string') return category;
    const existing = await this.findExistingCategory(category);
    return existing ?? this.normalizeCategory(category);
  }

  // ── Image upload helper ────────────────────────────────────────────────────

  /**
   * Upload all files to S3 and return image array for the product.
   * If imageMapping is provided, only use those file indices (in order).
   * Otherwise use all uploaded files.
   */
  private async buildProductImages(
    productId: string,
    files: Express.Multer.File[],
    imageMapping: number[],
  ): Promise<Array<{ _id: string; src: string; position: number }>> {
    const fileData = files.map((f) => ({
      buffer: f.buffer,
      originalName: f.originalname,
      mimeType: f.mimetype,
    }));

    const uploaded = await this.s3Service.uploadProductImages(productId, fileData);

    const effectiveIndices: number[] =
      imageMapping.length > 0 ? imageMapping : Array.from({ length: uploaded.length }, (_, i) => i);

    // Validate indices
    if (imageMapping.length > 0) {
      const outOfBounds = effectiveIndices.filter((idx) => idx < 0 || idx >= uploaded.length);
      if (outOfBounds.length > 0) {
        throw new ImageMappingError(
          `imageMapping references file index [${[...new Set(outOfBounds)].join(', ')}] but only ${uploaded.length} file(s) were uploaded`,
        );
      }
    }

    return effectiveIndices.map((idx, position) => ({
      _id: new mongoose.Types.ObjectId().toString(),
      src: uploaded[idx].url,
      position: position + 1,
    }));
  }

  // ── Public CRUD ────────────────────────────────────────────────────────────

  async getProducts(page: number, limit: number, filters?: any): Promise<{ products: Product[]; total: number }> {
    return this.productRepository.findAll(page, limit, filters);
  }

  async getProductById(productId: string): Promise<Product> {
    const product = await this.productRepository.findById(productId);
    if (!product) throw new ProductNotFoundError();
    return product;
  }

  async getProductBySlug(slug: string): Promise<Product> {
    const product = await this.productRepository.findBySlug(slug);
    if (!product) throw new ProductNotFoundError(`Product with slug "${slug}" not found`);
    return product;
  }

  async searchProducts(query: string, page: number, limit: number): Promise<{ products: Product[]; total: number }> {
    return this.productRepository.search(query, page, limit);
  }

  async getProductsByCategories(
    categories: string[],
    page: number,
    limit: number,
  ): Promise<{ products: Product[]; total: number }> {
    return this.productRepository.findByCategories(categories, page, limit);
  }

  async getRecommendedProducts(category: string, excludeId: string, limit: number = 5): Promise<Product[]> {
    return this.productRepository.findRecommended(category, excludeId, limit);
  }

  async getCategories(): Promise<string[]> {
    const categories = await this.productRepository.getCategories();
    return categories.map((c) => this.normalizeCategory(c));
  }

  async cleanProductData(): Promise<{ updated: number }> {
    return this.productRepository.cleanProductCategories();
  }

  async validateCategory(categoryName: string): Promise<{
    isValid: boolean;
    normalizedCategory?: string;
    existingCategory?: string;
    message?: string;
  }> {
    if (!categoryName || typeof categoryName !== 'string') {
      return { isValid: false, message: 'Category name is required and must be a string' };
    }
    const trimmed = categoryName.trim();
    if (trimmed.length === 0) {
      return { isValid: false, message: 'Category name cannot be empty' };
    }
    const existingCategory = await this.findExistingCategory(trimmed);
    const normalizedCategory = this.normalizeCategory(trimmed);
    if (existingCategory) {
      return {
        isValid: true,
        existingCategory,
        normalizedCategory: existingCategory,
        message: `Category "${trimmed}" already exists as "${existingCategory}"`,
      };
    }
    return {
      isValid: true,
      normalizedCategory,
      message: `Category "${trimmed}" will be created as "${normalizedCategory}"`,
    };
  }

  /**
   * Create a product.
   *
   * - files:        uploaded images (from multer)
   * - imageMapping: optional array of file indices to use (all used if omitted)
   */
  async createProduct(productData: CreateProductInput, files?: Express.Multer.File[]): Promise<Product> {
    // Normalize category
    if (productData.category) {
      const original = productData.category;
      productData.category = await this.normalizeOrFindCategory(productData.category);
      if (original !== productData.category) {
        logger.success('ProductService', 'createProduct', `Category normalized: "${original}" → "${productData.category}"`);
      }
    }

    const tempProductId = `temp_${Date.now()}`;
    const imageMapping = productData.imageMapping ?? [];

    if (imageMapping.length > 0 && (!files || files.length === 0)) {
      throw new ImageMappingError(
        'imageMapping was provided but no image files were uploaded.',
      );
    }

    let images: Array<{ _id: string; src: string; position: number }> = [];

    if (files && files.length > 0) {
      images = await this.buildProductImages(tempProductId, files, imageMapping);
    }

    const createData: Partial<Product> = {
      title: productData.title,
      description: productData.description,
      vendor: productData.vendor,
      category: productData.category,
      stoneType: productData.stoneType,
      color: productData.color,
      shape: productData.shape,
      carat: productData.carat,
      origin: productData.origin,
      treatment: productData.treatment,
      certificate: productData.certificate,
      measurement: productData.measurement,
      details: productData.details,
      sku: productData.sku,
      price: productData.price,
      stock: productData.stock ?? 0,
      thumbnail: images[0]?.src,
      images,
      diamondPcs: productData.diamondPcs ?? 0,
      availability: productData.availability ?? true,
      is_featured: productData.is_featured ?? false,
      tags: productData.tags ?? [],
      videoUrls: productData.videoUrls ?? [],
      certificateUrls: productData.certificateUrls ?? [],
    };

    return this.productRepository.create(createData);
  }

  /**
   * Update a product.
   */
  async updateProduct(
    productId: string,
    updateData: UpdateProductInput,
    files?: Express.Multer.File[],
  ): Promise<Product> {
    if (updateData.category) {
      const original = updateData.category;
      updateData.category = await this.normalizeOrFindCategory(updateData.category);
      if (original !== updateData.category) {
        logger.success('ProductService', 'updateProduct', `Category normalized: "${original}" → "${updateData.category}"`);
      }
    }

    const delImgMapping = updateData.delImgMapping ?? [];
    const imageMapping = updateData.imageMapping ?? [];

    if (imageMapping.length > 0 && (!files || files.length === 0)) {
      throw new ImageMappingError(
        'imageMapping was provided but no image files were uploaded.',
      );
    }

    // Fetch existing product if we need to handle images
    const needsExisting = (files && files.length > 0) || delImgMapping.length > 0;
    let existingProduct: Product | null = null;

    if (needsExisting) {
      existingProduct = await this.productRepository.findById(productId);
      if (!existingProduct) throw new ProductNotFoundError(`Product with ID ${productId} not found`);
    }

    let currentImages: Array<{ _id: string; src: string; position: number }> =
      existingProduct ? (existingProduct.images as any[]).map((img: any) =>
        img.toObject ? img.toObject() : { ...img }
      ) : [];

    // ── Apply image deletions ──────────────────────────────────────────────
    if (delImgMapping.length > 0) {
      for (const idx of delImgMapping) {
        if (idx < 0 || idx >= currentImages.length) {
          throw new ImageMappingError(
            `delImgMapping references image index ${idx} but product only has ${currentImages.length} image(s)`,
          );
        }
      }

      if (currentImages.length - new Set(delImgMapping).size < 1) {
        throw new ImageMappingError('Cannot delete all images from a product. At least one image must remain.');
      }

      const toDelete = [...new Set(delImgMapping)].map((idx) => currentImages[idx]);

      const sortedIndices = [...new Set(delImgMapping)].sort((a, b) => b - a);
      sortedIndices.forEach((idx) => currentImages.splice(idx, 1));
      currentImages.forEach((img, i) => { img.position = i + 1; });

      // Delete from S3 (non-fatal)
      for (const img of toDelete) {
        try {
          const key = new URL(img.src).pathname.slice(1);
          await this.s3Service.deleteFile(key);
        } catch {
          logger.error('ProductService', 'updateProduct', `S3 delete failed for image ${img._id}, continuing`);
        }
      }
    }

    // ── Apply new image uploads ────────────────────────────────────────────
    if (files && files.length > 0) {
      const newImages = await this.buildProductImages(productId, files, imageMapping);
      // Append new images after existing ones, re-number positions
      const startPosition = currentImages.length + 1;
      newImages.forEach((img, i) => { img.position = startPosition + i; });
      currentImages = [...currentImages, ...newImages];
    }

    // Build persist data
    const { imageMapping: _im, delImgMapping: _dim, ...persistFields } = updateData as any;
    const persistData: any = { ...persistFields };

    if (needsExisting) {
      persistData.images = currentImages;
      persistData.thumbnail = currentImages[0]?.src ?? existingProduct?.thumbnail ?? '';
    }

    const updatedProduct = await this.productRepository.updateById(productId, persistData);
    if (!updatedProduct) throw new ProductNotFoundError(`Product with ID ${productId} not found`);
    return updatedProduct;
  }

  async bulkCreateProducts(
    products: Array<{
      title: string; description: string; vendor: string; category: string;
      stoneType: string; color: string; shape: string; carat: number;
      origin: string; treatment: string; certificate: string; measurement: string;
      details: string; sku: string; price: number; stock?: number;
      diamondPcs?: number; availability?: boolean; is_featured?: boolean;
      tags?: string[]; videoUrls?: string[]; certificateUrls?: string[];
    }>,
  ): Promise<{ created: number; failed: number; details: Array<{ index: number; title: string; error: string }> }> {
    let created = 0;
    let failed = 0;
    const details: Array<{ index: number; title: string; error: string }> = [];

    for (let i = 0; i < products.length; i++) {
      const productData = products[i];
      try {
        const category = await this.normalizeOrFindCategory(productData.category);

        await this.productRepository.create({
          title: productData.title,
          description: productData.description,
          vendor: productData.vendor,
          category,
          stoneType: productData.stoneType,
          color: productData.color,
          shape: productData.shape,
          carat: productData.carat,
          origin: productData.origin,
          treatment: productData.treatment,
          certificate: productData.certificate,
          measurement: productData.measurement,
          details: productData.details,
          sku: productData.sku,
          price: productData.price,
          stock: productData.stock ?? 0,
          diamondPcs: productData.diamondPcs ?? 0,
          availability: productData.availability ?? true,
          is_featured: productData.is_featured ?? false,
          tags: productData.tags ?? [],
          videoUrls: productData.videoUrls ?? [],
          certificateUrls: productData.certificateUrls ?? [],
          images: [],
        } as any);

        created++;
      } catch (error: any) {
        failed++;
        details.push({ index: i, title: productData.title, error: error.message });
      }
    }

    return { created, failed, details };
  }

  async bulkUpdateProducts(
    updates: Array<{ productId: string; updateData: UpdateProductInput }>,
  ): Promise<BulkUpdateResult> {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new InvalidProductDataError('Updates array is required');
    }

    let updated = 0;
    let failed = 0;
    const details: Array<{ productId: string; error: string }> = [];

    for (const { productId, updateData } of updates) {
      try {
        await this.updateProduct(productId, updateData, undefined);
        updated++;
      } catch (error: any) {
        failed++;
        details.push({ productId, error: error.message });
      }
    }

    return { updated, failed, details };
  }

  async deleteProduct(productId: string): Promise<void> {
    const deleted = await this.productRepository.deleteById(productId);
    if (!deleted) throw new ProductNotFoundError();
  }

  async fetchAndStoreProducts(limit: number): Promise<{ stored: number; updated: number }> {
    const result = await this.dummyProductService.fetchAndStoreProducts(limit);
    return { stored: result.stored, updated: 0 };
  }

  async updateExistingProducts(limit: number): Promise<{ updated: number }> {
    return this.dummyProductService.updateExistingProducts(limit);
  }

  async getProductStats(): Promise<ProductStats> {
    const totalProducts = await this.productRepository.getCount();
    const categories = await this.productRepository.getCategories();
    return { totalProducts, totalCategories: categories.length, categories };
  }

  async getAllFilterOptions(): Promise<{
    categories: string[];
    stoneTypes: string[];
    colors: string[];
    shapes: string[];
    origins: string[];
    treatments: string[];
    certificates: string[];
    measurements: string[];
    vendors: string[];
    tags: string[];
    priceRange: { min: number; max: number };
    ratingRange: { min: number; max: number };
    caratRange: { min: number; max: number };
  }> {
    return this.productRepository.getAllFilterOptions();
  }
}
