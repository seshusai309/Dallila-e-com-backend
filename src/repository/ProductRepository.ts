import { Product, ProductModel } from '../models/Product';
import { logger } from '../utils/logger';

export class ProductRepository {
  // Create a new product
  async create(productData: Partial<Product>): Promise<Product> {
    try {
      const product = new ProductModel(productData);
      return await product.save();
    } catch (error: any) {
      logger.error('ProductRepository', 'create', `Failed to create product: ${error.message}`);
      throw error;
    }
  }

  // Find product by ID (MongoDB _id)
  async findById(id: string): Promise<Product | null> {
    try {
      return await ProductModel.findById(id);
    } catch (error: any) {
      logger.error('ProductRepository', 'findById', `Failed to find product: ${error.message}`);
      throw error;
    }
  }

  // Find product by slug
  async findBySlug(slug: string): Promise<Product | null> {
    try {
      return await ProductModel.findOne({ slug });
    } catch (error: any) {
      logger.error('ProductRepository', 'findBySlug', `Failed to find product: ${error.message}`);
      throw error;
    }
  }

  // Get all products with pagination and filters
  async findAll(page: number = 1, limit: number = 10, filters?: any): Promise<{ products: Product[], total: number }> {
    try {
      const skip = (page - 1) * limit;
      const query: any = {};
      
      // Handle search filter
      if (filters?.search) {
        const searchRegex = new RegExp(filters.search, 'i');
        query.$or = [
          { title: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { category: { $regex: searchRegex } },
          { tags: { $in: [searchRegex] } },
          { vendor: { $regex: searchRegex } },
          { stoneType: { $regex: searchRegex } },
          { color: { $regex: searchRegex } },
          { shape: { $regex: searchRegex } },
          { origin: { $regex: searchRegex } },
          { treatment: { $regex: searchRegex } },
          { certificate: { $regex: searchRegex } },
          { measurement: { $regex: searchRegex } },
          { details: { $regex: searchRegex } }
        ];
      }

      // Handle category filter
      if (filters?.category && Array.isArray(filters.category) && filters.category.length > 0) {
        query.category = { $in: filters.category };
      } else if (filters?.category && typeof filters.category === 'string') {
        query.category = filters.category;
      }

      // Handle other filters
      if (filters?.stoneType && Array.isArray(filters.stoneType) && filters.stoneType.length > 0) {
        query.stoneType = { $in: filters.stoneType };
      } else if (filters?.stoneType && typeof filters.stoneType === 'string') {
        query.stoneType = filters.stoneType;
      }

      if (filters?.color && Array.isArray(filters.color) && filters.color.length > 0) {
        query.color = { $in: filters.color };
      } else if (filters?.color && typeof filters.color === 'string') {
        query.color = filters.color;
      }

      if (filters?.shape && Array.isArray(filters.shape) && filters.shape.length > 0) {
        query.shape = { $in: filters.shape };
      } else if (filters?.shape && typeof filters.shape === 'string') {
        query.shape = filters.shape;
      }

      if (filters?.carat && Array.isArray(filters.carat) && filters.carat.length > 0) {
        const caratNumbers = filters.carat.map((c: string) => parseFloat(c)).filter((n: number) => !isNaN(n));
        if (caratNumbers.length > 0) {
          query.carat = { $in: caratNumbers };
        }
      } else if (filters?.carat && typeof filters.carat === 'string') {
        const caratValue = parseFloat(filters.carat);
        if (!isNaN(caratValue)) {
          query.carat = caratValue;
        }
      }

      if (filters?.origin && Array.isArray(filters.origin) && filters.origin.length > 0) {
        query.origin = { $in: filters.origin };
      } else if (filters?.origin && typeof filters.origin === 'string') {
        query.origin = filters.origin;
      }

      if (filters?.treatment && Array.isArray(filters.treatment) && filters.treatment.length > 0) {
        query.treatment = { $in: filters.treatment };
      } else if (filters?.treatment && typeof filters.treatment === 'string') {
        query.treatment = filters.treatment;
      }

      if (filters?.availability !== undefined) {
        query.availability = filters.availability === true || filters.availability === 'true';
      }

      if (filters?.certificate && Array.isArray(filters.certificate) && filters.certificate.length > 0) {
        query.certificate = { $in: filters.certificate };
      } else if (filters?.certificate && typeof filters.certificate === 'string') {
        query.certificate = filters.certificate;
      }

      if (filters?.measurement && Array.isArray(filters.measurement) && filters.measurement.length > 0) {
        query.measurement = { $in: filters.measurement };
      } else if (filters?.measurement && typeof filters.measurement === 'string') {
        query.measurement = filters.measurement;
      }

      if (filters?.details && Array.isArray(filters.details) && filters.details.length > 0) {
        query.details = { $in: filters.details };
      } else if (filters?.details && typeof filters.details === 'string') {
        query.details = filters.details;
      }

      if (filters?.vendor && Array.isArray(filters.vendor) && filters.vendor.length > 0) {
        query.vendor = { $in: filters.vendor };
      } else if (filters?.vendor && typeof filters.vendor === 'string') {
        query.vendor = filters.vendor;
      }

      if (filters?.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      } else if (filters?.tags && typeof filters.tags === 'string') {
        query.tags = filters.tags;
      }

      if (filters?.is_featured !== undefined) {
        query.is_featured = filters.is_featured === true || filters.is_featured === 'true';
      }

      // Handle rating range filters
      if (filters?.rating_min !== undefined || filters?.rating_max !== undefined) {
        query.rating = {};
        if (filters?.rating_min !== undefined) {
          const ratingMin = parseFloat(filters.rating_min);
          if (!isNaN(ratingMin)) {
            query.rating.$gte = ratingMin;
          }
        }
        if (filters?.rating_max !== undefined) {
          const ratingMax = parseFloat(filters.rating_max);
          if (!isNaN(ratingMax)) {
            query.rating.$lte = ratingMax;
          }
        }
        // Remove empty rating object if no valid filters
        if (Object.keys(query.rating).length === 0) {
          delete query.rating;
        }
      }

      // Build base query for products
      let productsQuery = ProductModel.find(query);

      // Handle price range filters - need to filter based on variant prices
      if (filters?.price_min !== undefined || filters?.price_max !== undefined) {
        const priceFilter: any = {};
        if (filters?.price_min !== undefined) {
          const priceMin = parseFloat(filters.price_min);
          if (!isNaN(priceMin)) {
            priceFilter.$gte = priceMin;
          }
        }
        if (filters?.price_max !== undefined) {
          const priceMax = parseFloat(filters.price_max);
          if (!isNaN(priceMax)) {
            priceFilter.$lte = priceMax;
          }
        }

        // Only apply price filter if it's valid
        if (Object.keys(priceFilter).length > 0) {
          productsQuery = productsQuery.where('variants.price').gte(priceFilter.$gte || 0);
          if (priceFilter.$lte !== undefined) {
            productsQuery = productsQuery.where('variants.price').lte(priceFilter.$lte);
          }
        }
      }

      // Handle metal filter - filter by variant_name
      if (filters?.metal) {
        const metals = Array.isArray(filters.metal) ? filters.metal : [filters.metal];
        if (metals.length > 0) {
          productsQuery = productsQuery.where('variants.variant_name').in(metals);
        }
      }

      const products = await productsQuery
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      // Additional filtering for price range if needed (since MongoDB can't directly filter nested arrays with range)
      let filteredProducts = products;
      if (filters?.price_min !== undefined || filters?.price_max !== undefined) {
        const priceMin = filters?.price_min ? parseFloat(filters.price_min) : 0;
        const priceMax = filters?.price_max ? parseFloat(filters.price_max) : Infinity;

        filteredProducts = products.filter(product => {
          if (!isNaN(priceMin) && priceMin > 0) {
            return product.variants.some(variant => variant.price >= priceMin && 
              (isNaN(priceMax) || priceMax === Infinity || variant.price <= priceMax));
          }
          if (!isNaN(priceMax) && priceMax !== Infinity) {
            return product.variants.some(variant => variant.price <= priceMax);
          }
          return true;
        });
      }

      // Additional filtering for metal if needed (ensure products have at least one variant with the specified metal)
      if (filters?.metal) {
        const metals = Array.isArray(filters.metal) ? filters.metal : [filters.metal];
        filteredProducts = filteredProducts.filter(product => {
          return product.variants.some(variant => metals.includes(variant.variant_name));
        });
      }

      const total = await ProductModel.countDocuments(query);

      return { products: filteredProducts, total };
    } catch (error: any) {
      logger.error('ProductRepository', 'findAll', `Failed to get products: ${error.message}`);
      throw error;
    }
  }

  // Update product by ID
  async updateById(id: string, updateData: Partial<Product>): Promise<Product | null> {
    try {
      return await ProductModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
    } catch (error: any) {
      logger.error('ProductRepository', 'updateById', `Failed to update product: ${error.message}`);
      throw error;
    }
  }

  // Update product by SKU
  async updateBySku(sku: string, updateData: Partial<Product>): Promise<Product | null> {
    try {
      return await ProductModel.findOneAndUpdate(
        { sku },
        updateData,
        { new: true, runValidators: true }
      );
    } catch (error: any) {
      logger.error('ProductRepository', 'updateBySku', `Failed to update product: ${error.message}`);
      throw error;
    }
  }

  // Bulk update products
  async bulkUpdate(updates: Array<{ productId: string, updateData: Partial<Product> }>): Promise<{ updated: number, failed: number }> {
    try {
      let updated = 0;
      let failed = 0;

      for (const { productId, updateData } of updates) {
        try {
          // Use MongoDB _id instead of external id
          const result = await this.updateById(productId, updateData);
          if (result) {
            updated++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }
      }

      return { updated, failed };
    } catch (error: any) {
      logger.error('ProductRepository', 'bulkUpdate', `Failed to bulk update products: ${error.message}`);
      throw error;
    }
  }

  // Delete product by ID
  async deleteById(id: string): Promise<boolean> {
    try {
      const result = await ProductModel.findByIdAndDelete(id);
      return result !== null;
    } catch (error: any) {
      logger.error('ProductRepository', 'deleteById', `Failed to delete product: ${error.message}`);
      throw error;
    }
  }

  // Delete product by product ID (external ID)
  async deleteByProductId(productId: number): Promise<boolean> {
    try {
      const result = await ProductModel.findOneAndDelete({ id: productId });
      return result !== null;
    } catch (error: any) {
      logger.error('ProductRepository', 'deleteByProductId', `Failed to delete product: ${error.message}`);
      throw error;
    }
  }

  // Get products by category (single category - kept for backward compatibility)
  async findByCategory(category: string, page: number = 1, limit: number = 10): Promise<{ products: Product[], total: number }> {
    try {
      return await this.findAll(page, limit, category);
    } catch (error: any) {
      logger.error('ProductRepository', 'findByCategory', `Failed to get products by category: ${error.message}`);
      throw error;
    }
  }

  // Get products by multiple categories
  async findByCategories(categories: string[], page: number = 1, limit: number = 10): Promise<{ products: Product[], total: number }> {
    try {
      const skip = (page - 1) * limit;
      const query = {
        category: { $in: categories }
      };

      const products = await ProductModel.find(query)
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await ProductModel.countDocuments(query);

      return { products, total };
    } catch (error: any) {
      logger.error('ProductRepository', 'findByCategories', `Failed to get products by categories: ${error.message}`);
      throw error;
    }
  }

  // Search products
  async search(query: string, page: number = 1, limit: number = 10): Promise<{ products: Product[], total: number }> {
    try {
      const skip = (page - 1) * limit;
      const searchRegex = new RegExp(query, 'i');

      const products = await ProductModel.find({
        $or: [
          { title: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { category: { $regex: searchRegex } },
          { tags: { $in: [searchRegex] } }
        ]
      })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

      const total = await ProductModel.countDocuments({
        $or: [
          { title: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { category: { $regex: searchRegex } },
          { tags: { $in: [searchRegex] } }
        ]
      });

      return { products, total };
    } catch (error: any) {
      logger.error('ProductRepository', 'search', `Failed to search products: ${error.message}`);
      throw error;
    }
  }

  // Get recommended products by category, excluding a specific product
  async findRecommended(category: string, excludeId: string, limit: number = 5): Promise<Product[]> {
    try {
      return await ProductModel.find({ category, _id: { $ne: excludeId } })
        .limit(limit)
        .sort({ createdAt: -1 });
    } catch (error: any) {
      logger.error('ProductRepository', 'findRecommended', `Failed to get recommended products: ${error.message}`);
      throw error;
    }
  }

  // Get all categories
  async getCategories(): Promise<string[]> {
    try {
      const categories = await ProductModel.distinct('category');
      return categories;
    } catch (error: any) {
      logger.error('ProductRepository', 'getCategories', `Failed to get categories: ${error.message}`);
      throw error;
    }
  }

  // Clean existing product data by trimming category values
  async cleanProductCategories(): Promise<{ updated: number }> {
    try {
      const categoryResult = await ProductModel.updateMany(
        { category: { $regex: /^\s+|\s+$/ } },
        { $set: { category: { $trim: { input: "$category" } } } }
      );

      logger.success('ProductRepository', 'cleanProductCategories', `Cleaned ${categoryResult.modifiedCount} products`);
      return { updated: categoryResult.modifiedCount };
    } catch (error: any) {
      logger.error('ProductRepository', 'cleanProductCategories', `Failed to clean product data: ${error.message}`);
      throw error;
    }
  }

  // Check if product exists
  async exists(productId: number): Promise<boolean> {
    try {
      const product = await ProductModel.findOne({ id: productId });
      return product !== null;
    } catch (error: any) {
      logger.error('ProductRepository', 'exists', `Failed to check product existence: ${error.message}`);
      throw error;
    }
  }

  // Get product count
  async getCount(): Promise<number> {
    try {
      return await ProductModel.countDocuments();
    } catch (error: any) {
      logger.error('ProductRepository', 'getCount', `Failed to get product count: ${error.message}`);
      throw error;
    }
  }

  // Get all filter options
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
    try {
      const [
        categories,
        stoneTypes,
        colors,
        shapes,
        origins,
        treatments,
        certificates,
        measurements,
        vendors,
        tags,
        priceStats,
        ratingStats,
        caratStats
      ] = await Promise.all([
        ProductModel.distinct('category'),
        ProductModel.distinct('stoneType'),
        ProductModel.distinct('color'),
        ProductModel.distinct('shape'),
        ProductModel.distinct('origin'),
        ProductModel.distinct('treatment'),
        ProductModel.distinct('certificate'),
        ProductModel.distinct('measurement'),
        ProductModel.distinct('vendor'),
        ProductModel.distinct('tags').then(tags => tags.flat()),
        ProductModel.aggregate([
          { $unwind: '$variants' },
          { $group: { _id: null, min: { $min: '$variants.price' }, max: { $max: '$variants.price' } } }
        ]),
        ProductModel.aggregate([
          { $group: { _id: null, min: { $min: '$rating' }, max: { $max: '$rating' } } }
        ]),
        ProductModel.aggregate([
          { $group: { _id: null, min: { $min: '$carat' }, max: { $max: '$carat' } } }
        ])
      ]);

      // Get metals from variants
      const metals = await ProductModel.distinct('variants.variant_name');

      // Flatten tags array
      const flattenedTags = Array.isArray(tags) ? tags.flat().filter(Boolean) : [];

      // Extract price range
      const priceRange = priceStats.length > 0 ? {
        min: Math.floor(priceStats[0].min || 0),
        max: Math.ceil(priceStats[0].max || 0)
      } : { min: 0, max: 0 };

      // Extract rating range
      const ratingRange = ratingStats.length > 0 ? {
        min: Math.floor(ratingStats[0].min * 10) / 10,
        max: Math.ceil(ratingStats[0].max * 10) / 10
      } : { min: 0, max: 5 };

      // Extract carat range
      const caratRange = caratStats.length > 0 ? {
        min: Math.floor(caratStats[0].min * 100) / 100,
        max: Math.ceil(caratStats[0].max * 100) / 100
      } : { min: 0, max: 0 };

      return {
        categories: categories.filter(Boolean).sort(),
        stoneTypes: stoneTypes.filter(Boolean).sort(),
        colors: colors.filter(Boolean).sort(),
        shapes: shapes.filter(Boolean).sort(),
        origins: origins.filter(Boolean).sort(),
        treatments: treatments.filter(Boolean).sort(),
        certificates: certificates.filter(Boolean).sort(),
        measurements: measurements.filter(Boolean).sort(),
        vendors: vendors.filter(Boolean).sort(),
        tags: flattenedTags.sort(),
        metals: metals.filter(Boolean).sort(),
        priceRange,
        ratingRange,
        caratRange
      };
    } catch (error: any) {
      logger.error('ProductRepository', 'getAllFilterOptions', `Failed to get filter options: ${error.message}`);
      throw error;
    }
  }
}
