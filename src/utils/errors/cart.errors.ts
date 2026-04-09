import { AppError } from './app.error';

export class CartNotFoundError extends AppError {
  constructor(message: string = 'Cart not found') {
    super(message, 'CART_NOT_FOUND', 404);
  }
}

export class ProductNotFoundError extends AppError {
  constructor(message: string = 'Product not found') {
    super(message, 'PRODUCT_NOT_FOUND', 404);
  }
}

export class InsufficientStockError extends AppError {
  public availableStock: number;
  public requestedQuantity: number;

  constructor(availableStock: number, requestedQuantity: number) {
    super(`Only ${availableStock} items available in stock`, 'INSUFFICIENT_STOCK', 400);
    this.availableStock = availableStock;
    this.requestedQuantity = requestedQuantity;
  }
}

export class InsufficientVariantImagesError extends AppError {
  constructor(message: string = 'This product variant must have at least 2 images before it can be added to the cart') {
    super(message, 'INSUFFICIENT_VARIANT_IMAGES', 400);
  }
}
