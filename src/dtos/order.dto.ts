import { Expose, Transform } from 'class-transformer';
import { BaseDto } from './base.dto';

// Order Item DTO
export class OrderItemDto {
  @Expose()
  @Transform(({ obj }) => obj.productId?.toString())
  productId!: string;

  @Expose()
  title!: string;

  @Expose()
  price!: number;

  @Expose()
  quantity!: number;

  @Expose()
  thumbnail!: string;
}

// Shipping Address DTO
export class ShippingAddressDto {
  @Expose()
  street!: string;

  @Expose()
  city!: string;

  @Expose()
  state!: string;

  @Expose()
  postalCode!: string;

  @Expose()
  country!: string;
}

// Order Response DTO
export class OrderResponseDto extends BaseDto {
  @Expose()
  orderNumber!: string;

  @Expose()
  @Transform(({ obj }) => obj.user?.toString())
  userId!: string;

  @Expose()
  items!: OrderItemDto[];

  @Expose()
  shippingAddress!: ShippingAddressDto;

  @Expose()
  paymentMethod!: 'ONLINE' | 'COD';

  @Expose()
  paymentStatus!: 'pending' | 'completed' | 'failed';

  @Expose()
  orderStatus!: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

  @Expose()
  totalAmount!: number;

  @Expose()
  totalItems!: number;

  @Expose()
  paidAt?: Date;

  @Expose()
  transactionId?: string;

  @Expose()
  cancellationReason?: string;

  @Expose()
  refundStatus!: 'NONE' | 'REQUESTED' | 'INITIATED' | 'COMPLETED' | 'FAILED';

  @Expose()
  refundId?: string;

  @Expose()
  refundAmount?: number;

  @Expose()
  refundedAt?: Date;

  @Expose()
  get itemCount(): number {
    return this.items?.length || 0;
  }
}

// Payment History DTO
export class PaymentHistoryDto {
  @Expose()
  orderId!: string;

  @Expose()
  orderNumber!: string;

  @Expose()
  amount!: number;

  @Expose()
  status!: string;

  @Expose()
  method!: string;

  @Expose()
  date!: Date;
}

// Order Stats DTO
export class OrderStatsDto {
  @Expose()
  totalOrders!: number;

  @Expose()
  pendingOrders!: number;

  @Expose()
  confirmedOrders!: number;

  @Expose()
  shippedOrders!: number;

  @Expose()
  deliveredOrders!: number;

  @Expose()
  cancelledOrders!: number;

  @Expose()
  totalRevenue!: number;
}
