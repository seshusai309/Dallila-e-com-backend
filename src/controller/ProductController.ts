import { Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { ProductService, CreateProductInput, UpdateProductInput } from '../services/product.service';
import { ProductResponseDto, ProductStatsDto, ProductListItemDto, ProductOptionDto } from '../dtos/product.dto';
import { logger } from '../utils/logger';
import { createPaginatedResponse, parsePaginationParams } from '../utils/pagination';
import { ProductNotFoundError, InvalidProductDataError, ImageMappingError } from '../utils/errors/product.errors';

// Available query filters advertised to clients
const AVAILABLE_FILTERS = ['search', 'category', 'page', 'limit', 'stoneType', 'color', 'shape', 'carat', 'origin', 'treatment', 'availability', 'certificate', 'measurement', 'details', 'vendor', 'tags', 'is_featured', 'price_min', 'price_max', 'rating_min', 'rating_max', 'metal'];

export class ProductController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Parse variants sent as bracket notation in multipart form-data.
   *
   * multer does NOT interpret bracket notation, so keys like
   *   variants[0][title]  →  req.body["variants[0][title]"]
   *
   * This method reconstructs them into an ordered array of objects.
   */
  private parseVariantFields(body: Record<string, any>): Record<string, any>[] {
    // 1. variants already a parsed array (application/json body)
    if (body.variants && Array.isArray(body.variants)) {
      return body.variants;
    }

    // 2. variants as a JSON string (form-data)
    if (body.variants && typeof body.variants === 'string') {
      try {
        const parsed = JSON.parse(body.variants);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        throw new Error('Invalid variants JSON format');
      }
    }

    // 3. Bracket notation: variants[0][price]=1200  OR  "variants[0]": { price: 1200 }
    const map: Record<number, Record<string, any>> = {};

    for (const key of Object.keys(body)) {
      // variants[0][field] — individual form-data fields
      const deepMatch = key.match(/^variants\[(\d+)\]\[(\w+)\]$/);
      if (deepMatch) {
        const idx = parseInt(deepMatch[1], 10);
        const field = deepMatch[2];
        if (!map[idx]) map[idx] = {};
        map[idx][field] = body[key];
        continue;
      }

      // "variants[0]" as a literal key with an object value (JSON body)
      const shallowMatch = key.match(/^variants\[(\d+)\]$/);
      if (
        shallowMatch &&
        typeof body[key] === 'object' &&
        body[key] !== null &&
        !Array.isArray(body[key])
      ) {
        const idx = parseInt(shallowMatch[1], 10);
        if (!map[idx]) map[idx] = {};
        Object.assign(map[idx], body[key]);
      }
    }

    return Object.keys(map)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => ({ ...map[k], _variantIndex: k }));
  }

  /**
   * Parse a value that may arrive as a comma-separated string or an array.
   */
  private parseStringArray(value: string | string[] | undefined): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean);
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }

  /**
   * Parse imageMapping from JSON string.
   * Throws a 400-compatible error on malformed JSON.
   */
  private parseImageMapping(raw: string | undefined): number[][] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('imageMapping must be a JSON array');
      return parsed;
    } catch {
      throw new ImageMappingError('imageMapping must be a valid JSON array, e.g. [[0,1],[2,3]]');
    }
  }

  /**
   * Validate and coerce the raw variant records extracted from form-data.
   * Returns a typed array or throws a descriptive error.
   */
  private coerceVariants(
    raw: Record<string, string>[],
  ): CreateProductInput['variants'] {
    const VALID_NAMES = ['gold', 'silver', 'rose gold'];
    return raw.map((v, i) => {
      if (!v.title?.trim()) throw { field: `variants[${i}].title`, message: 'Variant title is required' };
      if (!VALID_NAMES.includes(v.variant_name)) {
        throw { field: `variants[${i}].variant_name`, message: 'variant_name must be gold, silver, or rose gold' };
      }
      if (!v.sku?.trim()) throw { field: `variants[${i}].sku`, message: 'Variant SKU is required' };
      if (!v.price) throw { field: `variants[${i}].price`, message: 'Variant price is required' };

      return {
        ...(v._id ? { _id: v._id } : {}),
        title: v.title.trim(),
        variant_name: v.variant_name as 'gold' | 'silver' | 'rose gold',
        sku: v.sku.trim(),
        stock: parseInt(v.stock ?? '0', 10) || 0,
        price: parseFloat(v.price),
        position: v.position ? parseInt(v.position, 10) : undefined,
      };
    });
  }

  /**
   * Coerce raw variant records for UPDATE — all fields are optional.
   * Only validates variant_name when provided.
   */
  private coerceVariantsForUpdate(raw: Record<string, any>[]): UpdateProductInput['variants'] {
    const VALID_NAMES = ['gold', 'silver', 'rose gold'];
    return raw.map((v, i) => {
      if (v.variant_name !== undefined && !VALID_NAMES.includes(v.variant_name)) {
        throw { field: `variants[${i}].variant_name`, message: 'variant_name must be gold, silver, or rose gold' };
      }
      const result: any = {};
      if (v._id !== undefined) result._id = v._id;
      if (v._variantIndex !== undefined) result._variantIndex = v._variantIndex;
      if (v.title !== undefined) result.title = String(v.title).trim();
      if (v.variant_name !== undefined) result.variant_name = v.variant_name;
      if (v.sku !== undefined) result.sku = String(v.sku).trim();
      if (v.stock !== undefined) result.stock = parseInt(String(v.stock), 10) || 0;
      if (v.price !== undefined) result.price = parseFloat(String(v.price));
      if (v.position !== undefined) result.position = parseInt(String(v.position), 10);
      return result;
    });
  }

  private buildFilterQuery(
    req: Request,
  ): { query: string; search?: string; categories?: string[]; appliedFilters: any } {
    const { 
      search, 
      category, 
      stoneType, 
      color, 
      shape, 
      carat, 
      origin, 
      treatment, 
      availability, 
      certificate, 
      measurement, 
      details, 
      vendor, 
      tags, 
      is_featured,
      price_min,
      price_max,
      rating_min,
      rating_max,
      metal
    } = req.query;
    const appliedFilters: any = {};
    let filterQuery = '';
    let searchQuery: string | undefined;
    let categoriesArray: string[] = [];

    if (search && typeof search === 'string') {
      searchQuery = search.trim();
      appliedFilters.search = searchQuery;
      filterQuery += `search=${searchQuery}&`;
    }

    if (category && typeof category === 'string') {
      categoriesArray = category.split(',').map((c) => c.trim()).filter(Boolean);
      if (categoriesArray.length > 0) {
        appliedFilters.category = categoriesArray;
        filterQuery += `category=${categoriesArray.join(',')}&`;
      }
    }

    // Handle new filter fields
    if (stoneType && typeof stoneType === 'string') {
      const stoneTypes = stoneType.split(',').map((c) => c.trim()).filter(Boolean);
      if (stoneTypes.length > 0) {
        appliedFilters.stoneType = stoneTypes;
        filterQuery += `stoneType=${stoneTypes.join(',')}&`;
      }
    }

    if (color && typeof color === 'string') {
      const colors = color.split(',').map((c) => c.trim()).filter(Boolean);
      if (colors.length > 0) {
        appliedFilters.color = colors;
        filterQuery += `color=${colors.join(',')}&`;
      }
    }

    if (shape && typeof shape === 'string') {
      const shapes = shape.split(',').map((c) => c.trim()).filter(Boolean);
      if (shapes.length > 0) {
        appliedFilters.shape = shapes;
        filterQuery += `shape=${shapes.join(',')}&`;
      }
    }

    if (carat && typeof carat === 'string') {
      const carats = carat.split(',').map((c) => c.trim()).filter(Boolean);
      if (carats.length > 0) {
        appliedFilters.carat = carats;
        filterQuery += `carat=${carats.join(',')}&`;
      }
    }

    if (origin && typeof origin === 'string') {
      const origins = origin.split(',').map((c) => c.trim()).filter(Boolean);
      if (origins.length > 0) {
        appliedFilters.origin = origins;
        filterQuery += `origin=${origins.join(',')}&`;
      }
    }

    if (treatment && typeof treatment === 'string') {
      const treatments = treatment.split(',').map((c) => c.trim()).filter(Boolean);
      if (treatments.length > 0) {
        appliedFilters.treatment = treatments;
        filterQuery += `treatment=${treatments.join(',')}&`;
      }
    }

    if (availability !== undefined) {
      const availabilityValue = availability === 'true';
      appliedFilters.availability = availabilityValue;
      filterQuery += `availability=${availabilityValue}&`;
    }

    if (certificate && typeof certificate === 'string') {
      const certificates = certificate.split(',').map((c) => c.trim()).filter(Boolean);
      if (certificates.length > 0) {
        appliedFilters.certificate = certificates;
        filterQuery += `certificate=${certificates.join(',')}&`;
      }
    }

    if (measurement && typeof measurement === 'string') {
      const measurements = measurement.split(',').map((c) => c.trim()).filter(Boolean);
      if (measurements.length > 0) {
        appliedFilters.measurement = measurements;
        filterQuery += `measurement=${measurements.join(',')}&`;
      }
    }

    if (details && typeof details === 'string') {
      const detailsArray = details.split(',').map((c) => c.trim()).filter(Boolean);
      if (detailsArray.length > 0) {
        appliedFilters.details = detailsArray;
        filterQuery += `details=${detailsArray.join(',')}&`;
      }
    }

    if (vendor && typeof vendor === 'string') {
      const vendors = vendor.split(',').map((c) => c.trim()).filter(Boolean);
      if (vendors.length > 0) {
        appliedFilters.vendor = vendors;
        filterQuery += `vendor=${vendors.join(',')}&`;
      }
    }

    if (tags && typeof tags === 'string') {
      const tagsArray = tags.split(',').map((c) => c.trim()).filter(Boolean);
      if (tagsArray.length > 0) {
        appliedFilters.tags = tagsArray;
        filterQuery += `tags=${tagsArray.join(',')}&`;
      }
    }

    if (is_featured !== undefined) {
      const isFeaturedValue = is_featured === 'true';
      appliedFilters.is_featured = isFeaturedValue;
      filterQuery += `is_featured=${isFeaturedValue}&`;
    }

    // Handle price range filters
    if (price_min && typeof price_min === 'string') {
      const priceMinValue = parseFloat(price_min);
      if (!isNaN(priceMinValue)) {
        appliedFilters.price_min = priceMinValue;
        filterQuery += `price_min=${priceMinValue}&`;
      }
    }

    if (price_max && typeof price_max === 'string') {
      const priceMaxValue = parseFloat(price_max);
      if (!isNaN(priceMaxValue)) {
        appliedFilters.price_max = priceMaxValue;
        filterQuery += `price_max=${priceMaxValue}&`;
      }
    }

    // Handle rating range filters
    if (rating_min && typeof rating_min === 'string') {
      const ratingMinValue = parseFloat(rating_min);
      if (!isNaN(ratingMinValue)) {
        appliedFilters.rating_min = ratingMinValue;
        filterQuery += `rating_min=${ratingMinValue}&`;
      }
    }

    if (rating_max && typeof rating_max === 'string') {
      const ratingMaxValue = parseFloat(rating_max);
      if (!isNaN(ratingMaxValue)) {
        appliedFilters.rating_max = ratingMaxValue;
        filterQuery += `rating_max=${ratingMaxValue}&`;
      }
    }

    // Handle metal filter (filter by variant_name)
    if (metal && typeof metal === 'string') {
      const metals = metal.split(',').map((m) => m.trim()).filter(Boolean);
      if (metals.length > 0) {
        appliedFilters.metal = metals;
        filterQuery += `metal=${metals.join(',')}&`;
      }
    }

    return {
      query: filterQuery.slice(0, -1),
      search: searchQuery,
      categories: categoriesArray,
      appliedFilters,
    };
  }

  private async getProductsWithFilters(
    filters: any,
    page: number,
    limit: number,
  ): Promise<{ products: any[]; total: number }> {
    return this.productService.getProducts(page, limit, filters);
  }

  // ── Public routes ──────────────────────────────────────────────────────────

  async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit } = parsePaginationParams(req.query as any, 12, 100);
      const filters = this.buildFilterQuery(req);
      const result = await this.getProductsWithFilters(filters.appliedFilters, page, limit);

      logger.success('anonymous', 'getProducts', `Retrieved ${result.products.length} products`);

      const data: ProductListItemDto[] = result.products.map((p) => {
        const doc = p.toObject();
        const variants = (doc.variants ?? []).map((v: any) => {
          // Get previewImage from second image in array (index 1) if available, otherwise use thumbnail
          const previewImage = v.images && v.images.length > 1 
            ? v.images[1]?.src || v.thumbnail
            : v.thumbnail || '';
          
          return {
            id: v._id?.toString(),
            title: v.title,
            price: v.price,
            available: v.stock > 0,
            position: v.position,
            thumbnail: v.thumbnail ?? '',
            previewImage,
          };
        });
        const prices = variants.map((v: any) => v.price).filter((n: number) => !isNaN(n));
        
        // Calculate options dynamically from variants
        const variantTitles = doc.variants?.map((v: any) => v.title) as string[] || [];
        const uniqueVariantNames = Array.from(new Set(variantTitles));
        const options: ProductOptionDto[] = uniqueVariantNames.length > 0 ? [{
          name: "Color",
          values: uniqueVariantNames
        }] : [];
        
        return {
          id: doc._id?.toString(),
          slug: doc.slug ?? '',
          title: doc.title,
          vendor: doc.vendor,
          rating: doc.rating,
          reviews_count: doc.reviews_count,
          tags: doc.tags ?? [],
          availability: doc.availability,
          variants,
          minPrice: prices.length > 0 ? Math.min(...prices) : 0,
          options,
        };
      });

      const paginatedResponse = createPaginatedResponse(data, result.total, page, limit);

      res.status(200).json({
        success: true,
        code: 'PRODUCTS_RETRIEVED',
        message: 'Products retrieved successfully',
        ...paginatedResponse,
        filters: { applied: Object.keys(filters.appliedFilters) },
      });
    } catch (error: any) {
      logger.error('anonymous', 'getProducts', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'PRODUCTS_ERROR', message: 'Failed to retrieve products. Please try again.' },
      });
    }
  }

  async getProductById(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const product = await this.productService.getProductById(id);

      logger.success('anonymous', 'getProductById', `Retrieved product: ${product.title}`);

      const productData = product.toObject();

      // Calculate options dynamically from variants
      const variantTitles = productData.variants?.map((v: any) => v.title) as string[] || [];
      const uniqueVariantNames = Array.from(new Set(variantTitles));
      const options: ProductOptionDto[] = uniqueVariantNames.length > 0 ? [{
        name: "Color",
        values: uniqueVariantNames
      }] : [];

      const productDto = plainToInstance(ProductResponseDto, productData, { excludeExtraneousValues: true });

      // Fetch recommended products from the same category
      const rawRecommended = await this.productService.getRecommendedProducts(
        productData.category,
        productData._id?.toString(),
        5,
      );

      const recommendedProducts: ProductListItemDto[] = rawRecommended.map((p) => {
        const doc = p.toObject();
        const variants = (doc.variants ?? []).map((v: any) => ({
          id: v._id?.toString(),
          title: v.title,
          price: v.price,
          available: v.stock > 0,
          position: v.position,
          thumbnail: v.thumbnail ?? '',
        }));
        const prices = variants.map((v: any) => v.price).filter((n: number) => !isNaN(n));
        const uniqueTitles = Array.from(new Set(doc.variants?.map((v: any) => v.title) as string[]));
        const recOptions: ProductOptionDto[] = uniqueTitles.length > 0 ? [{ name: 'Color', values: uniqueTitles }] : [];
        return {
          id: doc._id?.toString(),
          slug: doc.slug ?? '',
          title: doc.title,
          vendor: doc.vendor,
          rating: doc.rating,
          reviews_count: doc.reviews_count,
          tags: doc.tags ?? [],
          availability: doc.availability,
          variants,
          minPrice: prices.length > 0 ? Math.min(...prices) : 0,
          options: recOptions,
        };
      });

      res.status(200).json({
        success: true,
        code: 'PRODUCT_RETRIEVED',
        message: 'Product retrieved successfully',
        data: { ...productDto, options },
        recommendedProducts,
      });
    } catch (error: any) {
      if (error instanceof ProductNotFoundError) {
        res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } });
        return;
      }
      logger.error('anonymous', 'getProductById', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'PRODUCT_ERROR', message: 'Failed to retrieve product. Please try again.' },
      });
    }
  }

  async getProductBySlug(req: Request, res: Response): Promise<void> {
    try {
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const product = await this.productService.getProductBySlug(slug);

      logger.success('anonymous', 'getProductBySlug', `Retrieved product: ${product.title}`);

      const productData = product.toObject();

      const variantTitles = productData.variants?.map((v: any) => v.title) as string[] || [];
      const uniqueVariantNames = Array.from(new Set(variantTitles));
      const options: ProductOptionDto[] = uniqueVariantNames.length > 0 ? [{ name: 'Color', values: uniqueVariantNames }] : [];

      const productDto = plainToInstance(ProductResponseDto, productData, { excludeExtraneousValues: true });

      const rawRecommended = await this.productService.getRecommendedProducts(
        productData.category,
        productData._id?.toString(),
        5,
      );

      const recommendedProducts: ProductListItemDto[] = rawRecommended.map((p) => {
        const doc = p.toObject();
        const variants = (doc.variants ?? []).map((v: any) => ({
          id: v._id?.toString(),
          title: v.title,
          price: v.price,
          available: v.stock > 0,
          position: v.position,
          thumbnail: v.thumbnail ?? '',
        }));
        const prices = variants.map((v: any) => v.price).filter((n: number) => !isNaN(n));
        const uniqueTitles = Array.from(new Set(doc.variants?.map((v: any) => v.title) as string[]));
        const recOptions: ProductOptionDto[] = uniqueTitles.length > 0 ? [{ name: 'Color', values: uniqueTitles }] : [];
        return {
          id: doc._id?.toString(),
          slug: doc.slug ?? '',
          title: doc.title,
          vendor: doc.vendor,
          rating: doc.rating,
          reviews_count: doc.reviews_count,
          tags: doc.tags ?? [],
          availability: doc.availability,
          variants,
          minPrice: prices.length > 0 ? Math.min(...prices) : 0,
          options: recOptions,
        };
      });

      res.status(200).json({
        success: true,
        code: 'PRODUCT_RETRIEVED',
        message: 'Product retrieved successfully',
        data: { ...productDto, options },
        recommendedProducts,
      });
    } catch (error: any) {
      if (error instanceof ProductNotFoundError) {
        res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: error.message } });
        return;
      }
      logger.error('anonymous', 'getProductBySlug', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'PRODUCT_ERROR', message: 'Failed to retrieve product. Please try again.' },
      });
    }
  }

  async getAvailableFilters(_req: Request, res: Response): Promise<void> {
    res.status(200).json({
      success: true,
      code: 'FILTERS_RETRIEVED',
      message: 'Available filters retrieved successfully',
      data: AVAILABLE_FILTERS,
    });
  }

  async getAllFilters(_req: Request, res: Response): Promise<void> {
    try {
      const filterOptions = await this.productService.getAllFilterOptions();
      logger.success('anonymous', 'getAllFilters', `Retrieved all filter options`);
      res.status(200).json({
        success: true,
        code: 'ALL_FILTERS_RETRIEVED',
        message: 'All filter options retrieved successfully',
        data: filterOptions,
      });
    } catch (error: any) {
      logger.error('anonymous', 'getAllFilters', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'FILTERS_ERROR', message: 'Failed to retrieve filter options. Please try again.' },
      });
    }
  }

  async getCategories(_req: Request, res: Response): Promise<void> {
    try {
      const categories = await this.productService.getCategories();
      logger.success('anonymous', 'getCategories', `Retrieved ${categories.length} categories`);
      res.status(200).json({
        success: true,
        code: 'CATEGORIES_RETRIEVED',
        message: 'Categories retrieved successfully',
        data: categories,
      });
    } catch (error: any) {
      logger.error('anonymous', 'getCategories', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'CATEGORIES_ERROR', message: 'Failed to retrieve categories. Please try again.' },
      });
    }
  }

  // ── Admin: Create ──────────────────────────────────────────────────────────

  /**
   * POST /products  (multipart/form-data)
   *
   * Product-level fields:
   *   title, description, vendor, category, stoneType, color, shape, carat,
   *   origin, treatment, certificate, measurement, details, diamondPcs,
   *   availability, is_featured,
   *   tags (comma-separated string or repeated field),
   *   videoUrls / certificateUrls (same),
   *   imageMapping (JSON string, e.g. "[[0,1,2],[3,4,5]]")
   *
   * Variant fields (bracket notation):
   *   variants[0][title], variants[0][variant_name], variants[0][sku],
   *   variants[0][stock], variants[0][price], variants[0][position]
   *   variants[1][...], ...
   *
   * Image files:
   *   All uploaded under the "images" field; imageMapping maps file indices
   *   to variant indices.
   */
  async createProduct(req: Request, res: Response): Promise<void> {
    try {
      // 1. Parse variants from bracket-notation keys
      const rawVariants = this.parseVariantFields(req.body);

      if (rawVariants.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_VARIANTS', message: 'At least one variant is required' },
        });
        return;
      }

      // 2. Validate + coerce variants
      let variants: CreateProductInput['variants'];
      try {
        variants = this.coerceVariants(rawVariants);
      } catch (err: any) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: err.message, field: err.field },
        });
        return;
      }

      // 3. Parse imageMapping
      let imageMapping: number[][];
      try {
        imageMapping = this.parseImageMapping(req.body.imageMapping);
      } catch (err: any) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_IMAGE_MAPPING', message: err.message },
        });
        return;
      }

      // 4. Assemble product data
      const productData: CreateProductInput = {
        title: req.body.title?.trim(),
        description: req.body.description?.trim(),
        vendor: req.body.vendor?.trim(),
        category: req.body.category?.trim(),
        stoneType: req.body.stoneType?.trim(),
        color: req.body.color?.trim(),
        shape: req.body.shape?.trim(),
        carat: parseFloat(req.body.carat),
        origin: req.body.origin?.trim(),
        treatment: req.body.treatment?.trim(),
        certificate: req.body.certificate?.trim(),
        measurement: req.body.measurement?.trim(),
        details: req.body.details?.trim(),
        diamondPcs: parseInt(req.body.diamondPcs, 10) || 0,
        availability: req.body.availability !== 'false',
        is_featured: req.body.is_featured === 'true',
        tags: this.parseStringArray(req.body.tags),
        videoUrls: this.parseStringArray(req.body.videoUrls),
        certificateUrls: this.parseStringArray(req.body.certificateUrls),
        variants,
        imageMapping,
      };

      const files =
        req.files && Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : undefined;

      const product = await this.productService.createProduct(productData, files);

      logger.success(
        req.user?._id?.toString() ?? 'anonymous',
        'createProduct',
        `Created product: ${product.title}`,
      );

      const productDto = plainToInstance(ProductResponseDto, product.toObject(), {
        excludeExtraneousValues: true,
      });

      res.status(201).json({
        success: true,
        code: 'PRODUCT_CREATED',
        message: 'Product created successfully',
        data: productDto,
      });
    } catch (error: any) {
      logger.error(
        req.user?._id?.toString() ?? 'anonymous',
        'createProduct',
        `Failed: ${error.message}`,
      );

      if (error instanceof ImageMappingError) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_IMAGE_MAPPING', message: error.message },
        });
        return;
      }

      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((e: any) => e.message);
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: messages.join(', ') },
        });
        return;
      }

      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        res.status(409).json({
          success: false,
          error: { code: 'DUPLICATE_FIELD', message: `${field} already exists` },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: { code: 'CREATE_PRODUCT_ERROR', message: 'Failed to create product. Please try again.' },
      });
    }
  }

  // ── Admin: Update ──────────────────────────────────────────────────────────

  async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      // Parse variants if provided
      const rawVariants = this.parseVariantFields(req.body);

      let variants: UpdateProductInput['variants'];
      if (rawVariants.length > 0) {
        try {
          variants = this.coerceVariantsForUpdate(rawVariants);
        } catch (err: any) {
          res.status(400).json({
            success: false,
            error: { code: 'INVALID_INPUT', message: err.message, field: err.field },
          });
          return;
        }
      }

      let imageMapping: number[][] | undefined;
      try {
        imageMapping = req.body.imageMapping ? this.parseImageMapping(req.body.imageMapping) : undefined;
      } catch (err: any) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_IMAGE_MAPPING', message: err.message },
        });
        return;
      }

      let delImgMapping: number[][] | undefined;
      try {
        delImgMapping = req.body.delImgMapping ? this.parseImageMapping(req.body.delImgMapping) : undefined;
      } catch (err: any) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_DEL_IMG_MAPPING', message: err.message },
        });
        return;
      }

      const updateData: UpdateProductInput = {};

      // Only include fields that were actually sent
      if (req.body.title !== undefined) updateData.title = req.body.title?.trim();
      if (req.body.description !== undefined) updateData.description = req.body.description?.trim();
      if (req.body.vendor !== undefined) updateData.vendor = req.body.vendor?.trim();
      if (req.body.category !== undefined) updateData.category = req.body.category?.trim();
      if (req.body.stoneType !== undefined) updateData.stoneType = req.body.stoneType?.trim();
      if (req.body.color !== undefined) updateData.color = req.body.color?.trim();
      if (req.body.shape !== undefined) updateData.shape = req.body.shape?.trim();
      if (req.body.carat !== undefined) updateData.carat = parseFloat(req.body.carat);
      if (req.body.origin !== undefined) updateData.origin = req.body.origin?.trim();
      if (req.body.treatment !== undefined) updateData.treatment = req.body.treatment?.trim();
      if (req.body.certificate !== undefined) updateData.certificate = req.body.certificate?.trim();
      if (req.body.measurement !== undefined) updateData.measurement = req.body.measurement?.trim();
      if (req.body.details !== undefined) updateData.details = req.body.details?.trim();
      if (req.body.diamondPcs !== undefined) updateData.diamondPcs = parseInt(req.body.diamondPcs, 10);
      if (req.body.availability !== undefined) updateData.availability = req.body.availability !== 'false';
      if (req.body.is_featured !== undefined) updateData.is_featured = req.body.is_featured === 'true';
      if (req.body.tags !== undefined) updateData.tags = this.parseStringArray(req.body.tags);
      if (req.body.videoUrls !== undefined) updateData.videoUrls = this.parseStringArray(req.body.videoUrls);
      if (req.body.certificateUrls !== undefined)
        updateData.certificateUrls = this.parseStringArray(req.body.certificateUrls);
      if (variants) updateData.variants = variants;
      if (imageMapping) updateData.imageMapping = imageMapping;
      if (delImgMapping) updateData.delImgMapping = delImgMapping;

      const files =
        req.files && Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : undefined;

      const product = await this.productService.updateProduct(id, updateData, files);

      logger.success(
        req.user?._id?.toString() ?? 'anonymous',
        'updateProduct',
        `Updated product: ${product.title}`,
      );

      const productDto = plainToInstance(ProductResponseDto, product.toObject(), {
        excludeExtraneousValues: true,
      });

      res.status(200).json({
        success: true,
        code: 'PRODUCT_UPDATED',
        message: 'Product updated successfully',
        data: productDto,
      });
    } catch (error: any) {
      if (error instanceof ProductNotFoundError) {
        res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } });
        return;
      }
      if (error instanceof InvalidProductDataError) {
        res.status(400).json({
          success: false,
          error: { code: error.code, message: error.message },
        });
        return;
      }
      if (error instanceof ImageMappingError) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_IMAGE_MAPPING', message: error.message },
        });
        return;
      }
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((e: any) => e.message);
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: messages.join(', ') },
        });
        return;
      }
      logger.error(req.user?._id?.toString() ?? 'anonymous', 'updateProduct', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'UPDATE_PRODUCT_ERROR', message: 'Failed to update product. Please try again.' },
      });
    }
  }

  // ── Admin: Other ───────────────────────────────────────────────────────────

  async bulkUpdateProducts(req: Request, res: Response): Promise<void> {
    try {
      const { updates } = req.body as {
        updates: Array<{ productId: string; updateData: Record<string, any> }>;
      };

      const typedUpdates: Array<{ productId: string; updateData: UpdateProductInput }> = [];

      for (const { productId, updateData: raw } of updates) {
        const updateData: UpdateProductInput = {};

        if (raw.title !== undefined) updateData.title = raw.title.trim();
        if (raw.description !== undefined) updateData.description = raw.description.trim();
        if (raw.vendor !== undefined) updateData.vendor = raw.vendor.trim();
        if (raw.category !== undefined) updateData.category = raw.category.trim();
        if (raw.stoneType !== undefined) updateData.stoneType = raw.stoneType.trim();
        if (raw.color !== undefined) updateData.color = raw.color.trim();
        if (raw.shape !== undefined) updateData.shape = raw.shape.trim();
        if (raw.carat !== undefined) updateData.carat = raw.carat;
        if (raw.origin !== undefined) updateData.origin = raw.origin.trim();
        if (raw.treatment !== undefined) updateData.treatment = raw.treatment.trim();
        if (raw.certificate !== undefined) updateData.certificate = raw.certificate.trim();
        if (raw.measurement !== undefined) updateData.measurement = raw.measurement.trim();
        if (raw.details !== undefined) updateData.details = raw.details.trim();
        if (raw.diamondPcs !== undefined) updateData.diamondPcs = raw.diamondPcs;
        if (raw.availability !== undefined) updateData.availability = raw.availability;
        if (raw.is_featured !== undefined) updateData.is_featured = raw.is_featured;
        if (raw.tags !== undefined) updateData.tags = raw.tags;
        if (raw.videoUrls !== undefined) updateData.videoUrls = raw.videoUrls;
        if (raw.certificateUrls !== undefined) updateData.certificateUrls = raw.certificateUrls;

        if (Array.isArray(raw.variants) && raw.variants.length > 0) {
          try {
            updateData.variants = this.coerceVariantsForUpdate(raw.variants);
          } catch (err: any) {
            res.status(400).json({
              success: false,
              error: {
                code: 'INVALID_INPUT',
                message: `productId "${productId}": ${err.message}`,
                field: err.field,
              },
            });
            return;
          }
        }

        typedUpdates.push({ productId, updateData });
      }

      const result = await this.productService.bulkUpdateProducts(typedUpdates);
      logger.success(req.user?._id?.toString() ?? 'anonymous', 'bulkUpdateProducts', `Updated: ${result.updated}`);
      res.status(200).json({
        success: true,
        code: 'BULK_UPDATE_COMPLETED',
        message: `Bulk update completed: ${result.updated} updated, ${result.failed} failed`,
        data: result,
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() ?? 'anonymous', 'bulkUpdateProducts', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'BULK_UPDATE_ERROR', message: 'Failed to bulk update products. Please try again.' },
      });
    }
  }

  async bulkCreateProducts(req: Request, res: Response): Promise<void> {
    try {
      const { products } = req.body as { products: any[] };
      const result = await this.productService.bulkCreateProducts(products);
      logger.success(req.user?._id?.toString() ?? 'anonymous', 'bulkCreateProducts', `Created: ${result.created}, failed: ${result.failed}`);
      res.status(201).json({
        success: true,
        code: 'BULK_CREATE_COMPLETED',
        message: `Bulk create completed: ${result.created} created, ${result.failed} failed`,
        data: result,
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() ?? 'anonymous', 'bulkCreateProducts', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'BULK_CREATE_ERROR', message: 'Failed to bulk create products. Please try again.' },
      });
    }
  }

  async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await this.productService.deleteProduct(id);
      logger.success(req.user?._id?.toString() ?? 'anonymous', 'deleteProduct', `Deleted product: ${id}`);
      res.status(200).json({ success: true, code: 'PRODUCT_DELETED', message: 'Product deleted successfully' });
    } catch (error: any) {
      if (error instanceof ProductNotFoundError) {
        res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' } });
        return;
      }
      logger.error(req.user?._id?.toString() ?? 'anonymous', 'deleteProduct', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'DELETE_PRODUCT_ERROR', message: 'Failed to delete product. Please try again.' },
      });
    }
  }

  // ── Super-admin ────────────────────────────────────────────────────────────

  async fetchAndStoreProducts(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 30;
      const result = await this.productService.fetchAndStoreProducts(limit);
      logger.success(req.user?._id?.toString() ?? 'anonymous', 'fetchAndStoreProducts', `Stored: ${result.stored}`);
      res.status(200).json({
        success: true,
        code: 'PRODUCTS_FETCHED',
        message: `Products fetched and stored: ${result.stored} new products added`,
        data: result,
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() ?? 'anonymous', 'fetchAndStoreProducts', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'FETCH_PRODUCTS_ERROR', message: 'Failed to fetch and store products. Please try again.' },
      });
    }
  }

  async updateExistingProducts(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 30;
      const result = await this.productService.updateExistingProducts(limit);
      logger.success(req.user?._id?.toString() ?? 'anonymous', 'updateExistingProducts', `Updated: ${result.updated}`);
      res.status(200).json({
        success: true,
        code: 'PRODUCTS_UPDATED',
        message: `Products updated: ${result.updated} products`,
        data: result,
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() ?? 'anonymous', 'updateExistingProducts', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'UPDATE_PRODUCTS_ERROR', message: 'Failed to update existing products. Please try again.' },
      });
    }
  }

  async cleanProductData(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.productService.cleanProductData();
      logger.success(req.user?._id?.toString() ?? 'anonymous', 'cleanProductData', `Cleaned: ${result.updated}`);
      res.status(200).json({
        success: true,
        code: 'PRODUCT_DATA_CLEANED',
        message: `Product data cleaned: ${result.updated} products updated`,
        data: result,
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() ?? 'anonymous', 'cleanProductData', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'CLEAN_DATA_ERROR', message: 'Failed to clean product data. Please try again.' },
      });
    }
  }

  async validateCategory(req: Request, res: Response): Promise<void> {
    try {
      const { categoryName } = req.body;
      if (!categoryName) {
        res.status(400).json({
          success: false,
          error: { code: 'MISSING_CATEGORY_NAME', message: 'Category name is required in request body' },
        });
        return;
      }
      const result = await this.productService.validateCategory(categoryName);
      logger.success('anonymous', 'validateCategory', `Validated: "${categoryName}"`);
      res.status(200).json({
        success: true,
        code: 'CATEGORY_VALIDATED',
        message: 'Category validation completed',
        data: result,
      });
    } catch (error: any) {
      logger.error('anonymous', 'validateCategory', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'CATEGORY_VALIDATION_ERROR', message: 'Failed to validate category. Please try again.' },
      });
    }
  }

  async getProductStats(_req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.productService.getProductStats();
      logger.success('anonymous', 'getProductStats', `Retrieved stats: ${stats.totalProducts} products`);
      const statsDto = plainToInstance(ProductStatsDto, stats, { excludeExtraneousValues: true });
      res.status(200).json({
        success: true,
        code: 'PRODUCT_STATS_RETRIEVED',
        message: 'Product statistics retrieved successfully',
        data: statsDto,
      });
    } catch (error: any) {
      logger.error('anonymous', 'getProductStats', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'PRODUCT_STATS_ERROR', message: 'Failed to retrieve product statistics. Please try again.' },
      });
    }
  }
}
