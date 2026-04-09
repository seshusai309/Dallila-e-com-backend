import { z } from "zod";

const VALID_VARIANT_NAMES = ["gold", "silver", "rose gold"] as const;

// Fields that only exist inside variants — never valid at the product top level
const VARIANT_ONLY_FIELDS = ["price", "stock", "sku", "variant_name"] as const;

function rejectVariantFields(data: Record<string, unknown>) {
  const misplaced = VARIANT_ONLY_FIELDS.filter((f) => f in data);
  return misplaced;
}

// Inline variant schema used for parsed (non-bracket-notation) variant arrays
export const VariantSchema = z.object({
  title: z.string().min(1, "Variant title is required"),
  variant_name: z.enum(VALID_VARIANT_NAMES, {
    error: "variant_name must be gold, silver, or rose gold",
  }),
  sku: z.string().min(1, "Variant SKU is required"),
  stock: z.string().optional(),
  price: z.string().min(1, "Variant price is required"),
  position: z.string().optional(),
});

// Create Product — validates product-level form-data fields.
// Variant fields arrive as bracket notation (variants[0][title]) and are parsed
// separately in the controller, so we use .passthrough() to let them pass the
// Zod check without failing on unknown keys.
export const CreateProductSchema = z
  .object({
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
    diamondPcs: z.string().optional(),
    availability: z.string().optional(),
    is_featured: z.string().optional(),
    // tags / URLs may arrive as comma-separated string OR as a repeated field array
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    videoUrls: z.union([z.string(), z.array(z.string())]).optional(),
    certificateUrls: z.union([z.string(), z.array(z.string())]).optional(),
    // imageMapping is a JSON string: "[[0,1,2],[3,4,5]]"
    imageMapping: z.string().optional(),
  })
  .passthrough() // allow variants[0][title] keys to pass through without error
  .superRefine((data, ctx) => {
    const bad = rejectVariantFields(data);
    if (bad.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: [bad[0]],
        message: `'${bad.join(", ")}' ${bad.length > 1 ? "are" : "is a"} variant-level field${bad.length > 1 ? "s" : ""}. To update variant fields use bracket notation, e.g. variants[0][${bad[0]}]=value or send variants as JSON.`,
      });
    }
  });

// Update Product — all fields optional
export const UpdateProductSchema = z
  .object({
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
    diamondPcs: z.string().optional(),
    availability: z.string().optional(),
    is_featured: z.string().optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    videoUrls: z.union([z.string(), z.array(z.string())]).optional(),
    certificateUrls: z.union([z.string(), z.array(z.string())]).optional(),
    imageMapping: z.string().optional(),
    delImgMapping: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const bad = rejectVariantFields(data);
    if (bad.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: [bad[0]],
        message: `'${bad.join(", ")}' ${bad.length > 1 ? "are" : "is a"} variant-level field${bad.length > 1 ? "s" : ""}. To update variant fields use bracket notation, e.g. variants[0][${bad[0]}]=value or send variants as JSON.`,
      });
    }
  });

// ── Bulk Update ──────────────────────────────────────────────────────────────

const BulkVariantUpdateSchema = z.object({
  _id: z.string().optional(),
  title: z.string().min(1).optional(),
  variant_name: z.enum(VALID_VARIANT_NAMES, {
    error: "variant_name must be gold, silver, or rose gold",
  }).optional(),
  sku: z.string().min(1).optional(),
  stock: z.number().int().nonnegative().optional(),
  price: z.number().positive().optional(),
  position: z.number().int().optional(),
});

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
  diamondPcs: z.number().int().nonnegative().optional(),
  availability: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  videoUrls: z.array(z.string()).optional(),
  certificateUrls: z.array(z.string()).optional(),
  variants: z.array(BulkVariantUpdateSchema).optional(),
  // imageMapping and image uploads are not supported in bulk update
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

const BulkCreateVariantSchema = z.object({
  title: z.string().min(1, "Variant title is required"),
  variant_name: z.enum(VALID_VARIANT_NAMES, {
    error: "variant_name must be gold, silver, or rose gold",
  }),
  sku: z.string().min(1, "Variant SKU is required"),
  stock: z.number().int().nonnegative().optional(),
  price: z.number().positive("Variant price is required"),
  position: z.number().int().optional(),
});

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
  diamondPcs: z.number().int().nonnegative().optional(),
  availability: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  videoUrls: z.array(z.string()).optional(),
  certificateUrls: z.array(z.string()).optional(),
  variants: z.array(BulkCreateVariantSchema).min(1, "At least one variant is required"),
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
