// MUST be first — loads .env before any module reads process.env
import 'dotenv/config';

import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import axios from 'axios';
import mongoose from 'mongoose';
import puppeteer, { HTTPResponse } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import connectDB from '../config/db';
import { ProductModel } from '../models/Product';
import { S3Service } from '../integrations/s3.service';
import { logger } from '../utils/logger';

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const TEST_MODE = false;          // false = all rows
const IMAGES_TO_TAKE = 5;
const EXCEL_PATH = path.join(__dirname, '../data-products/PRU_2026-04-08.xlsx');
const IMAGES_BASE_PATH = path.join(__dirname, '../data-products/images');
const IMAGE_INTERCEPT_TIMEOUT_MS = 20000;
// ───────────────────────────────────────────────────────────────────────────────

// ─── RANDOM DATA HELPERS ──────────────────────────────────────────────────────
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randPrice(): number {
  // Random price between 50 and 100, two decimal places
  return Math.round((50 + Math.random() * 50) * 100) / 100;
}

function randCarat(): number {
  const options = [0.25, 0.30, 0.40, 0.50, 0.60, 0.75, 1.00, 1.25, 1.50, 2.00, 2.50, 3.00];
  return pick(options);
}

function randMeasurement(): string {
  const l = randInt(4, 12);
  const w = randInt(4, 10);
  const h = randInt(2, 6);
  return `${l}mm x ${w}mm x ${h}mm`;
}

const STONE_TYPES = ['Diamond', 'Emerald', 'Ruby', 'Sapphire', 'Pearl', 'Amethyst', 'Topaz', 'Opal'];
const COLORS      = ['Colorless', 'White', 'Yellow', 'Rose', 'Blue', 'Pink', 'Green', 'Red', 'Champagne'];
const SHAPES      = ['Round Brilliant', 'Princess', 'Oval', 'Cushion', 'Emerald Cut', 'Pear', 'Marquise', 'Heart', 'Radiant'];
const ORIGINS     = ['Lab-grown', 'Natural', 'India', 'South Africa', 'Russia', 'Brazil', 'Australia', 'Sri Lanka'];
const TREATMENTS  = ['None', 'Heat Treated', 'Irradiated', 'Fracture Filled', 'Laser Drilled', 'Clarity Enhanced'];
const CERTS       = ['IGI Certified', 'GIA Certified', 'HRD Certified', 'AGS Certified', 'EGL Certified'];
const VENDORS     = ['Dallila'];

function generateDescription(assetName: string, category: string, stoneType: string, shape: string, carat: number): string {
  const adjectives = ['exquisite', 'stunning', 'elegant', 'luxurious', 'timeless', 'radiant', 'breathtaking'];
  const finishes   = ['18k gold', '14k gold', 'platinum', 'sterling silver', 'rose gold', 'white gold'];
  return (
    `This ${pick(adjectives)} ${category.toLowerCase()} features a ${carat}-carat ${shape.toLowerCase()} cut ` +
    `${stoneType.toLowerCase()} set in ${pick(finishes)}. ` +
    `Crafted with precision and passion, it is the perfect gift for any occasion. ` +
    `Each piece — including ${assetName} — is individually inspected to meet the highest standards of quality.`
  );
}

function generateDetails(stoneType: string, carat: number, origin: string, treatment: string, diamondPcs: number): string {
  return (
    `Stone: ${stoneType} | Carat: ${carat} | Origin: ${origin} | Treatment: ${treatment} | ` +
    `Pieces: ${diamondPcs} | Setting: Prong | Finish: High Polish | Hallmarked: Yes`
  );
}

function generateTags(category: string, stoneType: string, color: string): string[] {
  return [
    category.toLowerCase(),
    stoneType.toLowerCase(),
    color.toLowerCase(),
    'jewellery',
    'luxury',
    'gift',
  ].filter(Boolean);
}
// ─────────────────────────────────────────────────────────────────────────────

interface XlsxRow {
  assetType: string;
  assetName: string;
  videoUrl: string;
}

function parseXlsx(): XlsxRow[] {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  return rows.slice(1).filter(r => r[0] && r[1] && r[2]).map(r => ({
    assetType: String(r[0]).trim(),
    assetName: String(r[1]).trim(),
    videoUrl:  String(r[2]).trim(),
  }));
}

async function scrapeImageUrls(studioUrl: string): Promise<string[]> {
  logger.success('seedProducts', 'scrapeImageUrls', `Launching Puppeteer for: ${studioUrl}`);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const collectedUrls: string[] = [];

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // Product frames: /1.jpg … /8.jpg served as binary/octet-stream — filter by URL
    page.on('response', async (response: HTTPResponse) => {
      const url = response.url();
      if (/\/\d+\.jpg(\?|$)/i.test(url) && collectedUrls.length < IMAGES_TO_TAKE * 2) {
        if (!collectedUrls.includes(url)) {
          collectedUrls.push(url);
          logger.success('seedProducts', 'scrapeImageUrls', `Captured [${collectedUrls.length}]: ${url.substring(0, 80)}...`);
        }
      }
    });

    await page.goto(studioUrl, { waitUntil: 'networkidle2', timeout: IMAGE_INTERCEPT_TIMEOUT_MS });
    await new Promise(res => setTimeout(res, 5000));

  } finally {
    await browser.close();
  }

  const result = collectedUrls.slice(0, IMAGES_TO_TAKE);
  logger.success('seedProducts', 'scrapeImageUrls', `Collected ${result.length} signed URL(s)`);
  return result;
}

async function downloadImagesToLocal(
  assetName: string,
  imageUrls: string[]
): Promise<Array<{ buffer: Buffer; originalName: string; mimeType: string }>> {
  const folder = path.join(IMAGES_BASE_PATH, assetName);

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  const results: Array<{ buffer: Buffer; originalName: string; mimeType: string }> = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const filename = `${i + 1}.jpg`;
    const filePath = path.join(folder, filename);

    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
      const buffer = Buffer.from(response.data);

      fs.writeFileSync(filePath, buffer);
      logger.success('seedProducts', 'downloadImagesToLocal', `Saved to disk: ${filePath} (${buffer.length} bytes)`);

      results.push({ buffer, originalName: filename, mimeType: 'image/jpeg' });
    } catch (err: any) {
      logger.warn('seedProducts', 'downloadImagesToLocal', `Failed to download image ${i + 1}: ${err.message}`);
    }
  }

  return results;
}

async function main() {
  await connectDB();
  const s3Service = new S3Service();

  const rows = parseXlsx();
  const rowsToProcess = TEST_MODE ? rows.slice(0, 1) : rows;

  logger.success('seedProducts', 'main', `Processing ${rowsToProcess.length} product(s) — TEST_MODE=${TEST_MODE}`);

  let created = 0;
  let failed  = 0;
  let skipped = 0;

  for (const row of rowsToProcess) {
    const { assetType, assetName, videoUrl } = row;
    logger.success('seedProducts', 'main', `--- [${created + failed + skipped + 1}/${rowsToProcess.length}] ${assetName} (${assetType}) ---`);

    // Skip if SKU already exists
    const existing = await ProductModel.findOne({ sku: assetName });
    if (existing) {
      logger.warn('seedProducts', 'main', `SKU "${assetName}" already exists — skipping`);
      skipped++;
      continue;
    }

    // Step 1 — Scrape signed image URLs from Studio360
    let imageUrls: string[] = [];
    try {
      imageUrls = await scrapeImageUrls(videoUrl);
    } catch (err: any) {
      logger.error('seedProducts', 'main', `Puppeteer failed for ${assetName}: ${err.message}`);
      failed++;
      continue;
    }

    if (imageUrls.length === 0) {
      logger.warn('seedProducts', 'main', `No images captured for ${assetName} — skipping`);
      failed++;
      continue;
    }

    // Step 2 — Download to data-products/images/{sku}/ on disk
    const imageFiles = await downloadImagesToLocal(assetName, imageUrls);

    if (imageFiles.length === 0) {
      logger.warn('seedProducts', 'main', `All image downloads failed for ${assetName} — skipping`);
      failed++;
      continue;
    }

    // Step 3 — Upload from local files to your AWS S3
    const s3Id = assetName.replace(/[^a-zA-Z0-9_-]/g, '_');
    let s3Results: Array<{ url: string; key: string }> = [];
    try {
      s3Results = await s3Service.uploadProductImages(s3Id, imageFiles);
      logger.success('seedProducts', 'main', `Uploaded ${s3Results.length} image(s) to S3`);
    } catch (err: any) {
      logger.error('seedProducts', 'main', `S3 upload failed for ${assetName}: ${err.message}`);
      failed++;
      continue;
    }

    const s3Urls = s3Results.map(r => r.url);

    // Step 4 — Generate random fields
    const stoneType  = pick(STONE_TYPES);
    const color      = pick(COLORS);
    const shape      = pick(SHAPES);
    const carat      = randCarat();
    const origin     = pick(ORIGINS);
    const treatment  = pick(TREATMENTS);
    const certificate = pick(CERTS);
    const measurement = randMeasurement();
    const diamondPcs  = randInt(1, 20);
    const price       = randPrice();

    const productData = {
      title:       assetName,
      sku:         assetName,
      category:    assetType,
      vendor:      pick(VENDORS),
      videoUrls:   [videoUrl],
      images: s3Urls.map((src, i) => ({
        _id:      uuidv4(),
        src,
        position: i + 1,
      })),
      thumbnail:   s3Urls[0],
      // Fixed fields
      price,
      stock:       200,
      // Generated fields
      description: generateDescription(assetName, assetType, stoneType, shape, carat),
      stoneType,
      color,
      shape,
      carat,
      origin,
      treatment,
      availability: true,
      certificate,
      measurement,
      details:     generateDetails(stoneType, carat, origin, treatment, diamondPcs),
      diamondPcs,
      tags:        generateTags(assetType, stoneType, color),
      rating:       0,
      reviews_count: 0,
      is_featured:  Math.random() < 0.2, // ~20% featured
    };

    // Step 5 — Save to MongoDB
    try {
      const product = new ProductModel(productData);
      await product.save();
      logger.success('seedProducts', 'main', `✅ Created: ${assetName} | price=$${price} | stock=200 | ${s3Urls.length} images`);
      created++;
    } catch (err: any) {
      logger.error('seedProducts', 'main', `MongoDB save failed for ${assetName}: ${err.message}`);
      failed++;
    }
  }

  logger.success('seedProducts', 'main', `\nDone — ${created} created, ${skipped} skipped, ${failed} failed`);
  await mongoose.connection.close();
}

main().catch(err => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
