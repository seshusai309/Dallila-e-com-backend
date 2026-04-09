import { AppError } from './app.error';

export class WishlistNotFoundError extends AppError {
  constructor(message: string = 'Wishlist not found') {
    super(message, 'WISHLIST_NOT_FOUND', 404);
  }
}

export class ProductNotFoundError extends AppError {
  constructor(message: string = 'Product not found') {
    super(message, 'PRODUCT_NOT_FOUND', 404);
  }
}

export class InsufficientVariantImagesError extends AppError {
  constructor(message: string = 'This product variant must have at least 2 images before it can be added to the wishlist') {
    super(message, 'INSUFFICIENT_VARIANT_IMAGES', 400);
  }
}
