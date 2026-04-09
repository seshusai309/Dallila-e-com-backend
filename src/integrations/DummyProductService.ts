import axios from 'axios';
import { ProductRepository } from '../repository/ProductRepository';
import { logger } from '../utils/logger';

export interface DummyProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  sku: string;
  weight: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  warrantyInformation: string;
  shippingInformation: string;
  availabilityStatus: string;
  reviews: Array<{
    rating: number;
    comment: string;
    date: string;
    reviewerName: string;
    reviewerEmail: string;
  }>;
  returnPolicy: string;
  minimumOrderQuantity: number;
  meta: {
    createdAt: string;
    updatedAt: string;
    barcode: string;
    qrCode: string;
  };
  images: string[];
  thumbnail: string;
}

export class DummyProductService {
  private productRepository: ProductRepository;
  private apiUrl: string;

  constructor() {
    this.productRepository = new ProductRepository();
    this.apiUrl = process.env.DUMMY_PRODUCTS_API || 'https://dummyjson.com/products';
  }

  // Fetch products from dummy API
  async fetchProducts(limit: number = 30): Promise<DummyProduct[]> {
    try {
      logger.success('system', 'fetchProducts', `Fetching ${limit} products from ${this.apiUrl}`);
      
      const response = await axios.get(`${this.apiUrl}?limit=${limit}`);
      
      if (response.data && response.data.products) {
        logger.success('system', 'fetchProducts', `Successfully fetched ${response.data.products.length} products`);
        return response.data.products;
      }
      
      throw new Error('Invalid response format from dummy API');
    } catch (error: any) {
      logger.error('system', 'fetchProducts', `Failed to fetch products: ${error.message}`);
      throw error;
    }
  }

  // Store products in database
  async storeProducts(products: DummyProduct[]): Promise<{ stored: number, skipped: number, failed: number }> {
    try {
      let stored = 0;
      let skipped = 0;
      let failed = 0;

      logger.success('system', 'storeProducts', `Starting to store ${products.length} products`);

      for (const product of products) {
        try {
          // Check if product already exists
          const exists = await this.productRepository.exists(product.id);
          
          if (exists) {
            logger.warn('system', 'storeProducts', `Product ${product.id} already exists, skipping`);
            skipped++;
            continue;
          }

          // Transform and store product
          const transformedProduct = this.transformProduct(product);
          await this.productRepository.create(transformedProduct);
          
          logger.success('system', 'storeProducts', `Stored product: ${product.title}`);
          stored++;
        } catch (error: any) {
          logger.error('system', 'storeProducts', `Failed to store product ${product.id}: ${error.message}`);
          failed++;
        }
      }

      logger.success('system', 'storeProducts', `Completed: ${stored} stored, ${skipped} skipped, ${failed} failed`);
      return { stored, skipped, failed };
    } catch (error: any) {
      logger.error('system', 'storeProducts', `Failed to store products: ${error.message}`);
      throw error;
    }
  }

  // Transform dummy product to our product format
  private transformProduct(dummyProduct: DummyProduct): any {
    return {
      title: dummyProduct.title,
      description: dummyProduct.description,
      category: dummyProduct.category,
      price: dummyProduct.price,
      discountPercentage: dummyProduct.discountPercentage,
      rating: dummyProduct.rating,
      stock: dummyProduct.stock,
      tags: dummyProduct.tags,
      sku: dummyProduct.sku,
      weight: dummyProduct.weight,
      dimensions: dummyProduct.dimensions,
      warrantyInformation: dummyProduct.warrantyInformation,
      shippingInformation: dummyProduct.shippingInformation,
      availabilityStatus: dummyProduct.availabilityStatus,
      reviews: dummyProduct.reviews,
      returnPolicy: dummyProduct.returnPolicy,
      minimumOrderQuantity: dummyProduct.minimumOrderQuantity,
      meta: dummyProduct.meta,
      images: dummyProduct.images,
      thumbnail: dummyProduct.thumbnail
    };
  }

  // Fetch and store products in one operation
  async fetchAndStoreProducts(limit: number = 30): Promise<{ fetched: number, stored: number, skipped: number, failed: number }> {
    try {
      const products = await this.fetchProducts(limit);
      const result = await this.storeProducts(products);
      
      return {
        fetched: products.length,
        ...result
      };
    } catch (error: any) {
      logger.error('system', 'fetchAndStoreProducts', `Failed to fetch and store products: ${error.message}`);
      throw error;
    }
  }

  // Update existing products from dummy API
  async updateExistingProducts(limit: number = 30): Promise<{ updated: number, failed: number }> {
    try {
      const products = await this.fetchProducts(limit);
      let updated = 0;
      let failed = 0;

      logger.success('system', 'updateExistingProducts', `Starting to update ${products.length} products`);

      // Find products by SKU and update them
      for (const product of products) {
        try {
          const result = await this.productRepository.updateBySku(product.sku, this.transformProduct(product));
          if (result) {
            updated++;
          } else {
            failed++;
          }
        } catch (error) {
          failed++;
        }
      }
      
      logger.success('system', 'updateExistingProducts', `Completed: ${updated} updated, ${failed} failed`);
      return { updated, failed };
    } catch (error: any) {
      logger.error('system', 'updateExistingProducts', `Failed to update products: ${error.message}`);
      throw error;
    }
  }

  // Get product count from dummy API
  async getProductCount(): Promise<number> {
    try {
      const response = await axios.get(`${this.apiUrl}?limit=1`);
      return response.data.total || 0;
    } catch (error: any) {
      logger.error('system', 'getProductCount', `Failed to get product count: ${error.message}`);
      throw error;
    }
  }

  // Fetch products by category from dummy API
  async fetchProductsByCategory(category: string, limit: number = 10): Promise<DummyProduct[]> {
    try {
      logger.success('system', 'fetchProductsByCategory', `Fetching ${limit} products for category: ${category}`);
      
      const response = await axios.get(`${this.apiUrl}/category/${category}?limit=${limit}`);
      
      if (response.data && response.data.products) {
        logger.success('system', 'fetchProductsByCategory', `Successfully fetched ${response.data.products.length} products for category: ${category}`);
        return response.data.products;
      }
      
      throw new Error('Invalid response format from dummy API');
    } catch (error: any) {
      logger.error('system', 'fetchProductsByCategory', `Failed to fetch products by category: ${error.message}`);
      throw error;
    }
  }

  // Search products from dummy API
  async searchProducts(query: string, limit: number = 10): Promise<DummyProduct[]> {
    try {
      logger.success('system', 'searchProducts', `Searching products with query: ${query}`);
      
      const response = await axios.get(`${this.apiUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      
      if (response.data && response.data.products) {
        logger.success('system', 'searchProducts', `Successfully found ${response.data.products.length} products for query: ${query}`);
        return response.data.products;
      }
      
      throw new Error('Invalid response format from dummy API');
    } catch (error: any) {
      logger.error('system', 'searchProducts', `Failed to search products: ${error.message}`);
      throw error;
    }
  }

  // Get product by ID from dummy API
  async fetchProductById(id: number): Promise<DummyProduct> {
    try {
      logger.success('system', 'fetchProductById', `Fetching product with ID: ${id}`);
      
      const response = await axios.get(`${this.apiUrl}/${id}`);
      
      if (response.data) {
        logger.success('system', 'fetchProductById', `Successfully fetched product: ${response.data.title}`);
        return response.data;
      }
      
      throw new Error('Product not found');
    } catch (error: any) {
      logger.error('system', 'fetchProductById', `Failed to fetch product by ID: ${error.message}`);
      throw error;
    }
  }

  // Get categories from dummy API
  async getCategories(): Promise<string[]> {
    try {
      logger.success('system', 'getCategories', 'Fetching product categories');
      
      const response = await axios.get(`${this.apiUrl}/categories`);
      
      if (response.data) {
        logger.success('system', 'getCategories', `Successfully fetched ${response.data.length} categories`);
        return response.data;
      }
      
      throw new Error('Invalid response format from dummy API');
    } catch (error: any) {
      logger.error('system', 'getCategories', `Failed to fetch categories: ${error.message}`);
      throw error;
    }
  }
}
