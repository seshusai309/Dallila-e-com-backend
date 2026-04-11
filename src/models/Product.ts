import mongoose, { Schema, Document } from "mongoose";

export interface IProductImage {
  _id: string;
  src: string;
  position: number;
}

export interface Product extends Document {
  title: string;
  slug: string;
  description: string;
  tags: string[];
  vendor: string;
  rating: number;
  reviews_count: number;
  is_featured: boolean;
  category: string;
  stoneType: string;
  color: string;
  shape: string;
  carat: number;
  origin: string;
  treatment: string;
  availability: boolean;
  certificate: string;
  measurement: string;
  details: string;
  videoUrls?: string[];
  certificateUrls?: string[];
  diamondPcs: number;
  sku: string;
  price: number;
  stock: number;
  thumbnail?: string;
  images: IProductImage[];
  createdAt: Date;
  updatedAt: Date;
}

const productImageSchema = new Schema<IProductImage>({
  _id: { type: String, required: true },
  src: { type: String, required: true },
  position: { type: Number, required: true }
});

function generateSlug(title: string, id: string): string {
  const titleSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  const uniquePart = id.toString().slice(-6);
  return `${titleSlug}-${uniquePart}`;
}

const productSchema = new Schema<Product>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, required: true },
    tags: [{ type: String }],
    vendor: { type: String, required: true },
    rating: { type: Number, default: 0 },
    reviews_count: { type: Number, default: 0 },
    is_featured: { type: Boolean, default: false },
    category: { type: String, required: true, index: true },
    stoneType: { type: String, required: true },
    color: { type: String, required: true },
    shape: { type: String, required: true },
    carat: { type: Number, required: true },
    origin: { type: String, required: true },
    treatment: { type: String, required: true },
    availability: { type: Boolean, required: true, default: true },
    certificate: { type: String, required: true },
    measurement: { type: String, required: true },
    details: { type: String, required: true },
    videoUrls: [{ type: String }],
    certificateUrls: [{ type: String }],
    diamondPcs: { type: Number, required: true, default: 0 },
    sku: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0 },
    thumbnail: { type: String, required: false },
    images: [productImageSchema]
  },
  { timestamps: true }
);

productSchema.pre('save', async function () {
  if (this.isNew || !this.slug) {
    this.slug = generateSlug(this.title, this._id.toString());
  }
});

productSchema.index({ vendor: 1 });
productSchema.index({ tags: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ is_featured: 1 });

export { generateSlug };
export const ProductModel = mongoose.model<Product>("Product", productSchema);
