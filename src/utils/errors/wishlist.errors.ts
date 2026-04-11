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

