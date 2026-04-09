import { AppError } from './app.error';

export class ProductNotFoundError extends AppError {
  constructor(message: string = 'Product not found') {
    super(message, 'PRODUCT_NOT_FOUND', 404);
  }
}

export class InvalidProductDataError extends AppError {
  constructor(message: string = 'Invalid product data') {
    super(message, 'INVALID_PRODUCT_DATA', 400);
  }
}

export class ImageMappingError extends AppError {
  constructor(message: string = 'Invalid image mapping') {
    super(message, 'INVALID_IMAGE_MAPPING', 400);
  }
}
