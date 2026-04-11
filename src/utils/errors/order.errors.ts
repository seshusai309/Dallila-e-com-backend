import { AppError } from './app.error';

export class OrderNotFoundError extends AppError {
  constructor(message: string = 'Order not found') {
    super(message, 'ORDER_NOT_FOUND', 404);
  }
}

export class AddressNotFoundError extends AppError {
  constructor(message: string = 'Address not found') {
    super(message, 'ADDRESS_NOT_FOUND', 404);
  }
}

export class AddressNotBelongToUserError extends AppError {
  constructor(message: string = 'Address does not belong to this user') {
    super(message, 'ADDRESS_NOT_BELONG_TO_USER', 403);
  }
}

export class OrderCannotBeCancelledError extends AppError {
  public currentStatus: string;

  constructor(currentStatus: string) {
    super(`Order cannot be cancelled. Current status: ${currentStatus}`, 'ORDER_CANNOT_BE_CANCELLED', 400);
    this.currentStatus = currentStatus;
  }
}

export class InvalidOrderStatusError extends AppError {
  constructor(message: string = 'Invalid order status') {
    super(message, 'INVALID_ORDER_STATUS', 400);
  }
}

export class OrderAlreadyPaidError extends AppError {
  public orderId: string;
  constructor(orderId: string) {
    super('Order is already paid', 'ORDER_ALREADY_PAID', 200);
    this.orderId = orderId;
  }
}

export class PaymentInProgressError extends AppError {
  constructor() {
    super('Payment is already in progress. Please wait or retry in a moment.', 'PAYMENT_IN_PROGRESS', 409);
  }
}

export class InsufficientStockError extends AppError {
  public availableStock: number;
  public requestedQuantity: number;
  public productName?: string;

  constructor(availableStock: number, requestedQuantity: number, productName?: string) {
    const msg = productName
      ? `Insufficient stock for ${productName}. Available: ${availableStock}`
      : `Insufficient stock. Available: ${availableStock}, Requested: ${requestedQuantity}`;
    super(msg, 'INSUFFICIENT_STOCK', 400);
    this.availableStock = availableStock;
    this.requestedQuantity = requestedQuantity;
    this.productName = productName;
  }
}

