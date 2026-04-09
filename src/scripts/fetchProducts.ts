#!/usr/bin/env node

import axios from 'axios';
import { writeFileSync } from 'fs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ProductModel, generateSlug } from '../models/Product';

// Load environment variables
dotenv.config();

// Configuration
const SHOPIFY_PRODUCTS_URL = 'https://iwantjewels.com/products.json';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce';

// Helper functions
const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, '').trim();
};

const mapVariantName = (option1: string): 'gold' | 'silver' | 'rose gold' => {
  const mapping: Record<string, 'gold' | 'silver' | 'rose gold'> = {
    'Yellow Gold': 'gold',
    'White Gold': 'silver',
    'Rose Gold': 'rose gold'
  };
  return mapping[option1] || 'gold';
};

const extractStoneType = (title: string): string => {
  if (title.toLowerCase().includes('diamond')) return 'Diamond';
  if (title.toLowerCase().includes('emerald')) return 'Emerald';
  if (title.toLowerCase().includes('ruby')) return 'Ruby';
  return 'Diamond'; // default
};

const extractColor = (title: string): string => {
  const colors = ['Colorless', 'Yellow', 'Rose', 'White', 'Blue', 'Pink'];
  const foundColor = colors.find(color => title.toLowerCase().includes(color.toLowerCase()));
  return foundColor || 'Colorless';
};

const generateDetails = (shopifyProduct: any): string => {
  const variantCount = shopifyProduct.variants.length;
  const stoneType = extractStoneType(shopifyProduct.title);
  return `Each ${shopifyProduct.product_type.toLowerCase()} features ${variantCount} beautiful variants with ${stoneType.toLowerCase()} stones, crafted with precision and care.`;
};

const getRandomDiamondPcs = (): number => {
  return Math.floor(Math.random() * 10) + 1; // 1-10
};

// Group images to their respective variants by position order:
// A variant-tagged image starts a new group; untagged images fall into the current group
const buildVariantImageMap = (images: any[], variants: any[]): Record<number, any[]> => {
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const map: Record<number, any[]> = {};
  variants.forEach(v => { map[v.id] = []; });

  let currentVariantId: number | null = null;

  for (const img of sorted) {
    if (img.variant_ids.length > 0) {
      currentVariantId = img.variant_ids[0];
    }
    if (currentVariantId !== null && map[currentVariantId] !== undefined) {
      map[currentVariantId].push({
        _id: img.id.toString(),
        src: img.src,
        position: 0 // placeholder, renumbered below
      });
    }
  }

  // Renumber positions per-variant starting from 1
  for (const variantId of Object.keys(map)) {
    map[Number(variantId)].forEach((img, i) => { img.position = i + 1; });
  }

  return map;
};

// Main transformation function
const transformShopifyProduct = (shopifyProduct: any) => {
  const variantImageMap = buildVariantImageMap(shopifyProduct.images, shopifyProduct.variants);
  
  // Check if any variant has less than 2 images
  const variantsWithImageCount = shopifyProduct.variants.map((variant: any) => {
    const variantImages = variantImageMap[variant.id] || [];
    return {
      variant,
      imageCount: variantImages.length
    };
  });
  
  const hasInsufficientImages = variantsWithImageCount.some((v: any) => v.imageCount < 2);
  if (hasInsufficientImages) {
    return null; // Skip this product
  }

  const transformedProduct: any = {
    title: shopifyProduct.title,
    slug: generateSlug(shopifyProduct.title, shopifyProduct.id.toString()),
    description: stripHtml(shopifyProduct.body_html),
    tags: shopifyProduct.tags || [],
    vendor: shopifyProduct.vendor || 'I Want Jewels',
    rating: 0,
    reviews_count: 0,
    is_featured: shopifyProduct.tags?.includes('Featured') || false,
    category: shopifyProduct.product_type || 'Jewelry',
    stoneType: extractStoneType(shopifyProduct.title),
    color: extractColor(shopifyProduct.title),
    shape: 'Round Brilliant',
    carat: 0.5,
    origin: 'Lab-grown',
    treatment: 'None',
    availability: true,
    certificate: 'IGI Certified',
    measurement: '12mm x 8mm x 4mm',
    details: generateDetails(shopifyProduct),
    videoUrls: [],
    certificateUrls: [],
    diamondPcs: getRandomDiamondPcs(),
    variants: shopifyProduct.variants.map((variant: any) => {
      const variantImages = variantImageMap[variant.id] || [];

      return {
        _id: variant.id.toString(),
        title: variant.title,
        variant_name: mapVariantName(variant.option1),
        sku: variant.sku,
        stock: variant.available ? 50 : 0,
        price: parseFloat(variant.price),
        position: variant.position,
        thumbnail: variant.featured_image?.src || '',
        images: variantImages
      };
    })
  };
  
  return transformedProduct;
};

// Main execution function
const main = async () => {
  try {
    console.log('🔄 Starting Shopify to MongoDB transformation...');
    
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Fetch products from Shopify
    console.log('📥 Fetching products from Shopify...');
    const response = await axios.get(SHOPIFY_PRODUCTS_URL);
    const shopifyProducts = response.data.products || response.data; // Handle both formats
    
    console.log(`📊 Found ${shopifyProducts.length} products`);

    // Transform and save products
    console.log('💾 Transforming products...');
    const transformedProducts = shopifyProducts.map(transformShopifyProduct);
    
    // Filter out null products (those with insufficient images)
    const validProducts = transformedProducts.filter((product: any) => product !== null);
    const skippedCount = transformedProducts.length - validProducts.length;
    
    console.log(`📊 Processed ${shopifyProducts.length} products`);
    console.log(`✅ Valid products: ${validProducts.length}`);
    if (skippedCount > 0) {
      console.log(`⚠️  Skipped ${skippedCount} products with less than 2 variant images`);
    }
    
    // Clear existing products before re-inserting
    await ProductModel.deleteMany({});
    console.log('🗑️  Cleared existing products');

    // Save transformed products
    console.log('💾 Saving transformed products to MongoDB...');
    const savedProducts = await ProductModel.insertMany(validProducts, { ordered: false });
    
    console.log(`✅ Successfully saved ${savedProducts.length} products to MongoDB`);
    
    // Save transformation summary
    const summary = {
      totalProcessed: shopifyProducts.length,
      totalSaved: savedProducts.length,
      skippedDueToInsufficientImages: skippedCount,
      timestamp: new Date().toISOString(),
      sampleProduct: savedProducts[0] ? {
        id: savedProducts[0]._id,
        title: savedProducts[0].title,
        category: savedProducts[0].category,
        variantsCount: savedProducts[0].variants.length,
        diamondPcs: savedProducts[0].diamondPcs
      } : null
    };
    
    writeFileSync('./transformation-summary.json', JSON.stringify(summary, null, 2));
    console.log('📄 Transformation summary saved to transformation-summary.json');

    // Close MongoDB connection
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    console.log('🎉 Transformation completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during transformation:', error);
    process.exit(1);
  }
};

// Run the script
if (require.main === module) {
  main();
}

export { transformShopifyProduct };
