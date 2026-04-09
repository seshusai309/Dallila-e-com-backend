import mongoose from 'mongoose';
import { ProductRepository } from '../repository/ProductRepository';
import { DummyProductService as DummyProductIntegration } from '../integrations/DummyProductService';
import { S3Service } from '../integrations/s3.service';
import { Product } from '../models/Product';
import { ProductNotFoundError, InvalidProductDataError, ImageMappingError } from '../utils/errors/product.errors';
import { logger } from '../utils/logger';

// ── Input types ──────────────────────────────────────────────────────────────

export interface CreateVariantInput {
  title: string;
  variant_name: 'gold' | 'silver' | 'rose gold';
  sku: string;
  stock?: number;
  price: number;
  position?: number;
}

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
  diamondPcs?: number;
  availability?: boolean;
  is_featured?: boolean;
  tags?: string[];
  videoUrls?: string[];
  certificateUrls?: string[];
  variants: CreateVariantInput[];
  // imageMapping[i] = array of uploaded-file indices that belong to variant i
  imageMapping?: number[][];
}

export interface UpdateVariantInput {
  _id?: string;
  title?: string;
  variant_name?: 'gold' | 'silver' | 'rose gold';
  sku?: string;
  stock?: number;
  price?: number;
  position?: number;
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
  diamondPcs?: number;
  availability?: boolean;
  is_featured?: boolean;
  tags?: string[];
  videoUrls?: string[];
  certificateUrls?: string[];
  variants?: UpdateVariantInput[];
  imageMapping?: number[][];
  delImgMapping?: number[][];
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
   * Upload all files to S3, then distribute them to variants according to
   * imageMapping.  Returns an array of variant image arrays ready for saving.
   *
   * imageMapping[i] = [fileIndex, fileIndex, ...]  → variant i gets those files
   *
   * Fallback when imageMapping is empty or shorter than variantCount:
   *   images are assigned sequentially — one file per variant in order.
   *   e.g. 3 files + 3 variants → variant 0 gets file 0, variant 1 gets file 1, etc.
   */
  private async buildVariantImages(
    productId: string,
    files: Express.Multer.File[],
    imageMapping: number[][],
    variantCount: number,
  ): Promise<Array<Array<{ _id: string; src: string; position: number }>>> {
    // Upload every file once
    const fileData = files.map((f) => ({
      buffer: f.buffer,
      originalName: f.originalname,
      mimeType: f.mimetype,
    }));

    const uploaded = await this.s3Service.uploadProductImages(productId, fileData);

    // If no imageMapping provided, fall back to sequential 1-per-variant assignment
    const effectiveMapping: number[][] =
      imageMapping.length === 0
        ? Array.from({ length: variantCount }, (_, i) => (i < uploaded.length ? [i] : []))
        : imageMapping;

    // ── Validate imageMapping against uploaded files ───────────────────────
    if (imageMapping.length > 0) {
      const allIndices = effectiveMapping.flat();

      // 1. Every referenced index must be within bounds
      const outOfBounds = allIndices.filter((idx) => idx < 0 || idx >= uploaded.length);
      if (outOfBounds.length > 0) {
        throw new ImageMappingError(
          `imageMapping references file index [${[...new Set(outOfBounds)].join(', ')}] but only ${uploaded.length} file(s) were uploaded (valid indices: 0–${uploaded.length - 1})`,
        );
      }

      // 2. Every uploaded file must be referenced — no orphaned uploads
      const referencedCount = new Set(allIndices).size;
      if (referencedCount !== uploaded.length) {
        throw new ImageMappingError(
          `imageMapping references ${referencedCount} unique file(s) but ${uploaded.length} file(s) were uploaded — every uploaded image must be assigned to a variant`,
        );
      }
    }

    // Build per-variant image arrays
    const result: Array<Array<{ _id: string; src: string; position: number }>> = Array.from(
      { length: variantCount },
      () => [],
    );

    for (let vi = 0; vi < variantCount; vi++) {
      const indices = effectiveMapping[vi] ?? [];
      result[vi] = indices.map((idx, position) => ({
        _id: new mongoose.Types.ObjectId().toString(),
        src: uploaded[idx].url,
        position: position + 1,
      }));
    }

    return result;
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
   * - files:        all uploaded images (from multer)
   * - imageMapping: productData.imageMapping[i] = file indices for variant i
   *                 e.g. [[0,1,2],[3,4,5],[6,7]]
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

    // imageMapping without uploaded files is meaningless — reject early
    if (imageMapping.length > 0 && (!files || files.length === 0)) {
      throw new ImageMappingError(
        'imageMapping was provided but no image files were uploaded. ' +
        'Either upload image files along with imageMapping, or remove imageMapping from the request.',
      );
    }

    // Validate imageMapping dimensions
    if (imageMapping.length > 0 && imageMapping.length !== productData.variants.length) {
      throw new ImageMappingError(
        `imageMapping has ${imageMapping.length} entries but there are ${productData.variants.length} variants`,
      );
    }

    // Validate that all variants have images assigned in imageMapping
    if (imageMapping.length > 0) {
      const emptyVariants = imageMapping
        .map((mapping, index) => ({ index, hasImages: mapping.length > 0 }))
        .filter((variant) => !variant.hasImages);
      
      if (emptyVariants.length > 0) {
        throw new ImageMappingError(
          `All variants must have images assigned. Variant(s) at index [${emptyVariants.map((v) => v.index).join(', ')}] have no images. ` +
          'Please ensure every variant in imageMapping has at least one image assigned.',
        );
      }
    }

    // Validate that at least one variant will have an image
    if (!files || files.length === 0) {
      throw new ImageMappingError(
        'At least one image is required for product variants. ' +
        'Please upload at least one image file when creating a product.'
      );
    }

    // Build variant image arrays (uploads to S3 internally)
    let variantImageGroups: Array<Array<{ _id: string; src: string; position: number }>> = productData.variants.map(
      () => [],
    );

    if (files && files.length > 0) {
      variantImageGroups = await this.buildVariantImages(
        tempProductId,
        files,
        imageMapping,
        productData.variants.length,
      );
    }

    // Validate that at least one variant has images after processing
    const hasVariantWithImages = variantImageGroups.some(images => images.length > 0);
    if (!hasVariantWithImages) {
      throw new ImageMappingError(
        'At least one variant must have an image. ' +
        'Please ensure imageMapping properly assigns uploaded images to variants.'
      );
    }

    // Assemble full variant documents
    const variants = productData.variants.map((v, i) => {
      const images = variantImageGroups[i] ?? [];
      return {
        _id: new mongoose.Types.ObjectId().toString(),
        title: v.title,
        variant_name: v.variant_name,
        sku: v.sku,
        stock: v.stock ?? 0,
        price: v.price,
        position: v.position ?? i + 1,
        thumbnail: images[0]?.src ?? '',
        images,
      };
    });

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
      diamondPcs: productData.diamondPcs ?? 0,
      availability: productData.availability ?? true,
      is_featured: productData.is_featured ?? false,
      tags: productData.tags ?? [],
      videoUrls: productData.videoUrls ?? [],
      certificateUrls: productData.certificateUrls ?? [],
      variants,
    };

    return this.productRepository.create(createData);
  }

  /**
   * For UPDATE only: imageMapping[variantIdx] = target position indices within that
   * variant's existing images array.
   *
   *   []    → preserve all existing images for this variant (no change)
   *   [0]   → replace image at position 0 with the new uploaded file
   *   [1]   → add a new image at position 1 (only valid if variant already has 1 image)
   *   [p]   → error if p > existing image count for that variant
   *
   * Files are consumed in order across all non-empty mapping entries.
   */
  private async buildVariantImagesForUpdate(
    productId: string,
    files: Express.Multer.File[],
    imageMapping: number[][],
    existingVariants: Array<{ images: Array<{ _id: string; src: string; position: number }>; thumbnail?: string }>,
  ): Promise<Array<Array<{ _id: string; src: string; position: number }>>> {
    // Count total files needed from position entries
    const totalFilesNeeded = imageMapping.reduce((sum, positions) => sum + positions.length, 0);
    if (totalFilesNeeded !== files.length) {
      throw new ImageMappingError(
        `imageMapping requires ${totalFilesNeeded} file(s) based on position entries, ` +
        `but ${files.length} file(s) were uploaded.`,
      );
    }

    // Validate all positions before uploading anything
    for (let vi = 0; vi < imageMapping.length; vi++) {
      const positions = imageMapping[vi];
      if (positions.length === 0) continue;
      const existingCount = existingVariants[vi]?.images?.length ?? 0;
      for (const p of positions) {
        if (p > existingCount) {
          throw new ImageMappingError(
            `Variant ${vi} has ${existingCount} image(s). ` +
            `To add a new image use index ${existingCount}, not ${p}.`,
          );
        }
      }
    }

    // Upload all files once
    const uploaded = await this.s3Service.uploadProductImages(
      productId,
      files.map((f) => ({ buffer: f.buffer, originalName: f.originalname, mimeType: f.mimetype })),
    );

    // Apply positions to each variant's image array
    let fileIdx = 0;
    const result: Array<Array<{ _id: string; src: string; position: number }>> = [];

    for (let vi = 0; vi < imageMapping.length; vi++) {
      const positions = imageMapping[vi];
      const existingImages = (existingVariants[vi]?.images ?? []).map((img) => ({
        _id: img._id,
        src: img.src,
        position: img.position,
      }));

      if (positions.length === 0) {
        result[vi] = existingImages; // preserve unchanged
        continue;
      }

      const updatedImages = [...existingImages];
      for (const p of positions) {
        const newImage = {
          _id: new mongoose.Types.ObjectId().toString(),
          src: uploaded[fileIdx].url,
          position: p,
        };
        fileIdx++;
        const existingAtPos = updatedImages.findIndex((img) => img.position === p);
        if (existingAtPos >= 0) {
          updatedImages[existingAtPos] = newImage; // replace
        } else {
          updatedImages.push(newImage); // add
        }
      }

      updatedImages.sort((a, b) => a.position - b.position);
      updatedImages.forEach((img, i) => { img.position = i + 1; });
      result[vi] = updatedImages;
    }

    return result;
  }

  /**
   * Update a product.
   *
   * Variant patches (variants[N]) and image updates (imageMapping + files) are
   * independent operations — both merge into the existing variants array.
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

    // delImgMapping must align with variant count — validated later after fetching product
    // imageMapping without files
    if (imageMapping.length > 0 && (!files || files.length === 0)) {
      throw new ImageMappingError(
        'imageMapping was provided but no image files were uploaded. ' +
        'Upload image files along with imageMapping, or remove imageMapping from the request.',
      );
    }

    // Files without imageMapping
    if (files && files.length > 0 && imageMapping.length === 0) {
      throw new ImageMappingError(
        'Image files were uploaded but imageMapping was not provided. ' +
        'Include imageMapping to specify where each image should be placed in each variant.',
      );
    }

    // Fetch existing product once if we need to touch variants or images
    const needsExisting = (updateData.variants && updateData.variants.length > 0) || (files && files.length > 0) || delImgMapping.length > 0;
    let existingProduct: Product | null = null;

    if (needsExisting) {
      existingProduct = await this.productRepository.findById(productId);
      if (!existingProduct) throw new ProductNotFoundError(`Product with ID ${productId} not found`);
    }

    // Build a mutable plain-object copy of ALL existing variants
    const merged: any[] = existingProduct
      ? existingProduct.variants.map((ev) => ((ev as any).toObject ? (ev as any).toObject() : { ...ev }))
      : [];

    // ── 0. Apply image deletions (delImgMapping) ────────────────────────────
    if (delImgMapping.length > 0) {
      if (delImgMapping.length !== merged.length) {
        throw new ImageMappingError(
          `delImgMapping has ${delImgMapping.length} entr${delImgMapping.length !== 1 ? 'ies' : 'y'} ` +
          `but the product has ${merged.length} variant${merged.length !== 1 ? 's' : ''}. ` +
          `Provide one entry per variant (use [] to skip a variant).`,
        );
      }

      for (let vi = 0; vi < delImgMapping.length; vi++) {
        const indices = delImgMapping[vi];
        if (indices.length === 0) continue;

        const images: Array<{ _id: string; src: string; position: number }> = merged[vi].images ?? [];

        // Validate indices
        for (const idx of indices) {
          if (idx < 0 || idx >= images.length) {
            throw new ImageMappingError(
              `delImgMapping[${vi}] references image index ${idx} but variant ${vi} only has ${images.length} image(s) (valid indices: 0–${images.length - 1}).`,
            );
          }
        }

        const uniqueIndices = [...new Set(indices)];
        if (images.length - uniqueIndices.length < 1) {
          throw new ImageMappingError(
            `Cannot delete all images from variant ${vi}. A variant must keep at least one image.`,
          );
        }

        // Collect srcs to delete from S3
        const toDelete = uniqueIndices.map((idx) => images[idx]);

        // Remove from array (high-to-low to preserve indices)
        uniqueIndices.sort((a, b) => b - a).forEach((idx) => images.splice(idx, 1));

        // Re-number positions
        images.forEach((img, i) => { img.position = i + 1; });

        // Fix thumbnail if it was one of the deleted images
        const deletedSrcs = new Set(toDelete.map((img) => img.src));
        if (deletedSrcs.has(merged[vi].thumbnail)) {
          merged[vi].thumbnail = images[0]?.src ?? '';
        }

        merged[vi].images = images;

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
    }

    // ── 1. Apply variant field patches ──────────────────────────────────────
    if (updateData.variants && updateData.variants.length > 0) {
      const patches = updateData.variants as any[];
      const variantCount = merged.length;

      // Validate patches reference existing variants (skip empty patch objects)
      patches.forEach((patch, i) => {
        const { _variantIndex, ...patchFields } = patch;
        if (Object.keys(patchFields).length === 0) return; // empty patch — nothing to do
        const patchIdx = typeof _variantIndex === 'number' ? _variantIndex : i;
        if (patch._id) {
          if (!merged.some((ev) => ev._id === patch._id)) {
            throw new InvalidProductDataError(
              `Variant with _id "${patch._id}" does not exist on this product. ` +
              `Valid variant IDs: ${merged.map((ev) => ev._id).join(', ')}`,
            );
          }
        } else if (patchIdx >= variantCount) {
          const validIndices = Array.from({ length: variantCount }, (_, k) => k).join(', ');
          throw new InvalidProductDataError(
            `This product only has ${variantCount} variant${variantCount !== 1 ? 's' : ''} ` +
            `(index${variantCount !== 1 ? 'es' : ''} ${validIndices}). ` +
            `Cannot update variants[${patchIdx}].`,
          );
        }
      });

      // Merge each patch into the corresponding variant (skip empty patch objects)
      patches.forEach((patch, i) => {
        const { _variantIndex, ...cleanPatch } = patch;
        if (Object.keys(cleanPatch).length === 0) return; // empty patch — nothing to do
        const targetIdx = cleanPatch._id
          ? merged.findIndex((ev) => ev._id === cleanPatch._id)
          : (typeof _variantIndex === 'number' ? _variantIndex : i);

        if (targetIdx >= 0 && targetIdx < merged.length) {
          merged[targetIdx] = {
            ...merged[targetIdx],
            ...cleanPatch,
            _id: merged[targetIdx]._id,
            images: merged[targetIdx].images ?? [],
            thumbnail: merged[targetIdx].thumbnail ?? '',
          };
        }
      });
    }

    // ── 2. Apply image updates (position-based) ──────────────────────────────
    if (files && files.length > 0) {
      if (imageMapping.length !== merged.length) {
        throw new ImageMappingError(
          `imageMapping has ${imageMapping.length} entr${imageMapping.length !== 1 ? 'ies' : 'y'} ` +
          `but the product has ${merged.length} variant${merged.length !== 1 ? 's' : ''}. ` +
          `Provide one imageMapping entry per variant (use [] to preserve a variant's images).`,
        );
      }

      const updatedImageArrays = await this.buildVariantImagesForUpdate(
        productId,
        files,
        imageMapping,
        merged,
      );

      merged.forEach((v, i) => {
        merged[i] = {
          ...v,
          images: updatedImageArrays[i],
          thumbnail: updatedImageArrays[i][0]?.src ?? v.thumbnail ?? '',
        };
      });
    }

    // Persist merged variants if we built them
    if (existingProduct) {
      updateData.variants = merged;
    }

    // Strip imageMapping / delImgMapping before persisting (not model fields)
    const { imageMapping: _removed, delImgMapping: _removedDel, ...persistData } = updateData as any;

    const updatedProduct = await this.productRepository.updateById(productId, persistData);
    if (!updatedProduct) throw new ProductNotFoundError(`Product with ID ${productId} not found`);
    return updatedProduct;
  }

  async bulkCreateProducts(
    products: Array<{
      title: string; description: string; vendor: string; category: string;
      stoneType: string; color: string; shape: string; carat: number;
      origin: string; treatment: string; certificate: string; measurement: string;
      details: string; diamondPcs?: number; availability?: boolean; is_featured?: boolean;
      tags?: string[]; videoUrls?: string[]; certificateUrls?: string[];
      variants: Array<{ title: string; variant_name: 'gold' | 'silver' | 'rose gold'; sku: string; stock?: number; price: number; position?: number }>;
    }>,
  ): Promise<{ created: number; failed: number; details: Array<{ index: number; title: string; error: string }> }> {
    let created = 0;
    let failed = 0;
    const details: Array<{ index: number; title: string; error: string }> = [];

    for (let i = 0; i < products.length; i++) {
      const productData = products[i];
      try {
        const category = await this.normalizeOrFindCategory(productData.category);

        const variants = productData.variants.map((v, vi) => ({
          _id: new mongoose.Types.ObjectId().toString(),
          title: v.title,
          variant_name: v.variant_name,
          sku: v.sku,
          stock: v.stock ?? 0,
          price: v.price,
          position: v.position ?? vi + 1,
          thumbnail: '',
          images: [],
        }));

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
          diamondPcs: productData.diamondPcs ?? 0,
          availability: productData.availability ?? true,
          is_featured: productData.is_featured ?? false,
          tags: productData.tags ?? [],
          videoUrls: productData.videoUrls ?? [],
          certificateUrls: productData.certificateUrls ?? [],
          variants,
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
    metals: string[];
    priceRange: { min: number; max: number };
    ratingRange: { min: number; max: number };
    caratRange: { min: number; max: number };
  }> {
    return this.productRepository.getAllFilterOptions();
  }
}
