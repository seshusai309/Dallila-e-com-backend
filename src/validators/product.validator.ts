import { z } from "zod";

// Create Product — validates product-level form-data fields.
export const CreateProductSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  description: z.string().min(1, "Description is required"),
  vendor: z.string().min(1, "Vendor is required"),
  category: z.string().min(1, "Category is required"),
  stoneType: z.string().min(1, "Stone type is required"),
  color: z.string().min(1, "Color is required"),
  shape: z.string().min(1, "Shape is required"),
  carat: z.string().min(1, "Carat is required"),
  origin: z.string().min(1, "Origin is required"),
  treatment: z.string().min(1, "Treatment is required"),
  certificate: z.string().min(1, "Certificate is required"),
  measurement: z.string().min(1, "Measurement is required"),
  details: z.string().min(1, "Details are required"),
  sku: z.string().min(1, "SKU is required"),
  price: z.string().min(1, "Price is required"),
  stock: z.string().optional(),
  diamondPcs: z.string().optional(),
  availability: z.string().optional(),
  is_featured: z.string().optional(),
  // tags / URLs may arrive as comma-separated string OR as a repeated field array
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  videoUrls: z.union([z.string(), z.array(z.string())]).optional(),
  certificateUrls: z.union([z.string(), z.array(z.string())]).optional(),
});

// Update Product — all fields optional
export const UpdateProductSchema = z.object({
  title: z.string().min(1, "Title is required").max(200).optional(),
  description: z.string().min(1).optional(),
  vendor: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  stoneType: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  shape: z.string().min(1).optional(),
  carat: z.string().min(1).optional(),
  origin: z.string().min(1).optional(),
  treatment: z.string().min(1).optional(),
  certificate: z.string().min(1).optional(),
  measurement: z.string().min(1).optional(),
  details: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  price: z.string().optional(),
  stock: z.string().optional(),
  diamondPcs: z.string().optional(),
  availability: z.string().optional(),
  is_featured: z.string().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  videoUrls: z.union([z.string(), z.array(z.string())]).optional(),
  certificateUrls: z.union([z.string(), z.array(z.string())]).optional(),
  imageMapping: z.string().optional(),
  delImgMapping: z.string().optional(),
});

// ── Bulk Update ──────────────────────────────────────────────────────────────

// Per-product updateData in a bulk request — native JSON types, no image fields
const BulkUpdateDataSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  vendor: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  stoneType: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  shape: z.string().min(1).optional(),
  carat: z.number().optional(),
  origin: z.string().min(1).optional(),
  treatment: z.string().min(1).optional(),
  certificate: z.string().min(1).optional(),
  measurement: z.string().min(1).optional(),
  details: z.string().min(1).optional(),
  sku: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().nonnegative().optional(),
  diamondPcs: z.number().int().nonnegative().optional(),
  availability: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  videoUrls: z.array(z.string()).optional(),
  certificateUrls: z.array(z.string()).optional(),
});

export const BulkUpdateProductSchema = z.object({
  updates: z
    .array(
      z.object({
        productId: z.string().min(1, "productId is required"),
        updateData: BulkUpdateDataSchema,
      }),
    )
    .min(1, "updates array must not be empty"),
});

export type BulkUpdateProductInput = z.infer<typeof BulkUpdateProductSchema>;

// ── Bulk Create ───────────────────────────────────────────────────────────────

const BulkCreateProductDataSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required"),
  vendor: z.string().min(1, "Vendor is required"),
  category: z.string().min(1, "Category is required"),
  stoneType: z.string().min(1, "Stone type is required"),
  color: z.string().min(1, "Color is required"),
  shape: z.string().min(1, "Shape is required"),
  carat: z.number({ error: "Carat must be a number" }),
  origin: z.string().min(1, "Origin is required"),
  treatment: z.string().min(1, "Treatment is required"),
  certificate: z.string().min(1, "Certificate is required"),
  measurement: z.string().min(1, "Measurement is required"),
  details: z.string().min(1, "Details are required"),
  sku: z.string().min(1, "SKU is required"),
  price: z.number().positive("Price is required"),
  stock: z.number().int().nonnegative().optional(),
  diamondPcs: z.number().int().nonnegative().optional(),
  availability: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  videoUrls: z.array(z.string()).optional(),
  certificateUrls: z.array(z.string()).optional(),
});

export const BulkCreateProductSchema = z.object({
  products: z
    .array(BulkCreateProductDataSchema)
    .min(1, "products array must not be empty"),
});

export type BulkCreateProductInput = z.infer<typeof BulkCreateProductSchema>;

// Search Products query params
export const SearchProductsQuerySchema = z.object({
  q: z.string().min(1, "Search query is required"),
  page: z.string().optional(),
  limit: z.string().optional(),
});

// Get Products query params
export const GetProductsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type SearchProductsQueryInput = z.infer<
  typeof SearchProductsQuerySchema
>;
export type GetProductsQueryInput = z.infer<typeof GetProductsQuerySchema>;
