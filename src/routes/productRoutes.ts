import { Router } from 'express';
import { ProductController } from '../controller/ProductController';
import { authenticateToken, requireAdmin, requireSuperAdmin } from '../middleware/auth';
import { uploadMultiple, handleUploadError } from '../middleware/upload';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { CreateProductSchema, UpdateProductSchema, BulkUpdateProductSchema, BulkCreateProductSchema } from '../validators/product.validator';

const router = Router();
const productController = new ProductController();

/**
 * @access public
 * @route GET /
 * @desc Get all products with pagination, search, and category filtering
 * @query params: page, limit, search, category (single or comma-separated multiple)
 */
router.get(
  '/',
  rateLimiter({ max: 50 }),
  productController.getProducts.bind(productController)
);

/**
 * @access public
 * @route GET /categories
 * @desc Get all product categories
 */
router.get(
  '/categories',
  rateLimiter({ max: 50 }),
  productController.getCategories.bind(productController)
);

/**
 * @access public
 * @route GET /filters
 * @desc Get all available filters for products
 */
router.get(
  '/filters',
  rateLimiter({ max: 50 }),
  productController.getAvailableFilters.bind(productController)
);

/**
 * @access public
 * @route GET /all-filters
 * @desc Get all filter options with values (categories, metals, price ranges, etc.)
 */
router.get(
  '/all-filters',
  rateLimiter({ max: 30 }),
  productController.getAllFilters.bind(productController)
);

/**
 * @access public
 * @route GET /stats
 * @desc Get product statistics
 */
router.get(
  '/stats',
  rateLimiter({ max: 30 }),
  productController.getProductStats.bind(productController)
);

/**
 * @access public
 * @route GET /slug/:slug
 * @desc Get product by slug
 */
router.get(
  '/slug/:slug',
  rateLimiter({ max: 50 }),
  productController.getProductBySlug.bind(productController)
);

/**
 * @access public
 * @route GET /:id
 * @desc Get product by ID
 */
router.get(
  '/:id',
  rateLimiter({ max: 50 }),
  productController.getProductById.bind(productController)
);

/**
 * @access private (admin only)
 * @route POST /
 * @desc Create new product (admin only)
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 10 }),
  uploadMultiple,
  handleUploadError,
  validate(CreateProductSchema),
  productController.createProduct.bind(productController)
);

/**
 * @access private (admin only)
 * @route PUT /:id
 * @desc Update product (admin only)
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 10 }),
  uploadMultiple,
  handleUploadError,
  validate(UpdateProductSchema),
  productController.updateProduct.bind(productController)
);

/**
 * @access private (admin only)
 * @route DELETE /:id
 * @desc Delete product (admin only)
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 5 }),
  productController.deleteProduct.bind(productController)
);

/**
 * @access private (admin only)
 * @route POST /bulk-create
 * @desc Bulk create products without images — add images later via PUT /:id (admin only)
 */
router.post(
  '/bulk-create',
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 10 }),
  validate(BulkCreateProductSchema),
  productController.bulkCreateProducts.bind(productController)
);

/**
 * @access private (admin only)
 * @route POST /bulk-update
 * @desc Bulk update products (admin only)
 */
router.post(
  '/bulk-update',
  authenticateToken,
  requireAdmin,
  rateLimiter({ max: 20 }),
  validate(BulkUpdateProductSchema),
  productController.bulkUpdateProducts.bind(productController)
);

/**
 * @access private (super admin only)
 * @route POST /fetch-store
 * @desc Fetch and store products from external API (super admin only)
 */
router.post(
  '/fetch-store',
  authenticateToken,
  requireSuperAdmin,
  rateLimiter({ max: 3 }),
  productController.fetchAndStoreProducts.bind(productController)
);

/**
 * @access private (super admin only)
 * @route POST /update-existing
 * @desc Update existing products (super admin only)
 */
router.post(
  '/update-existing',
  authenticateToken,
  requireSuperAdmin,
  rateLimiter({ max: 3 }),
  productController.updateExistingProducts.bind(productController)
);

/**
 * @access private (super admin only)
 * @route POST /clean-data
 * @desc Clean product data by trimming category values (super admin only)
 */
router.post(
  '/clean-data',
  authenticateToken,
  requireSuperAdmin,
  rateLimiter({ max: 1 }),
  productController.cleanProductData.bind(productController)
);

/**
 * @access public
 * @route POST /validate-category
 * @desc Validate and normalize category name
 */
router.post(
  '/validate-category',
  rateLimiter({ max: 20 }),
  productController.validateCategory.bind(productController)
);

export default router;
