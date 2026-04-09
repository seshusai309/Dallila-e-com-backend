import { OrderRepository } from "../repository/OrderRepository";
import { CartRepository } from "../repository/CartRepository";
import { ProductRepository } from "../repository/ProductRepository";
import { UserRepository } from "../repository/UserRepository";
import { AddressRepository } from "../repository/AddressRepository";
import { Order, OrderItem } from "../models/Order";
import { StripeService } from "../integrations/StripeService";
import { emailService } from "../utils/emailService";
import {
  OrderNotFoundError,
  AddressNotFoundError,
  AddressNotBelongToUserError,
  OrderCannotBeCancelledError,
  InvalidOrderStatusError,
  OrderAlreadyPaidError,
  PaymentInProgressError,
  InsufficientStockError,
  InsufficientVariantImagesError
} from "../utils/errors/order.errors";
import { CartNotFoundError } from "../utils/errors/cart.errors";

export interface CreateOrderInput {
  userId: string;
  addressId?: string;
  paymentMethod: "COD" | "ONLINE";
  successUrl?: string;
  cancelUrl?: string;
}

export interface OrderStats {
  totalOrders: number;
  totalAmount: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

export interface PaymentInfo {
  orderId: string;
  orderNumber: string;
  sessionId?: string;
  transactionId?: string;
  amount: number;
  paymentStatus: string;
  orderStatus: string;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
}

export class OrderService {
  private orderRepository: OrderRepository;
  private cartRepository: CartRepository;
  private productRepository: ProductRepository;
  private userRepository: UserRepository;
  private addressRepository: AddressRepository;
  private stripeService: StripeService;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.cartRepository = new CartRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
    this.addressRepository = new AddressRepository();
    this.stripeService = new StripeService();
  }

  /**
   * Create order from cart
   */
  async createOrder(
    input: CreateOrderInput,
  ): Promise<{ order: Order; checkoutSession?: CheckoutSession }> {
    const { userId, addressId, paymentMethod, successUrl, cancelUrl } = input;

    // Get user's cart
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart || cart.items.length === 0) {
      throw new CartNotFoundError(
        "Cart is empty. Add items to cart before placing order",
      );
    }

    // Look up the provided address or get default address
    let address;
    if (addressId) {
      // Use provided addressId and validate ownership
      address = await this.addressRepository.findById(addressId);
      if (!address) {
        throw new AddressNotFoundError("Address not found. Please provide a valid addressId.");
      }
      if (address.userId !== userId) {
        throw new AddressNotBelongToUserError("Address does not belong to this user.");
      }
    } else {
      // Get user's default address
      const userAddresses = await this.addressRepository.findByUserId(userId);
      address = userAddresses.find(addr => addr.isDefault);
      if (!address) {
        throw new AddressNotFoundError("No default address found. Please provide an addressId or set a default address.");
      }
    }

    // Validate products and get current prices
    const orderItems: OrderItem[] = [];
    let totalAmount = 0;
    let totalItems = 0;

    for (const cartItem of cart.items) {
      const product = await this.productRepository.findById(cartItem.productId);
      if (!product) {
        throw new Error(`Product ${cartItem.productId} not found`);
      }

      const variant = product.variants.find(
        (v) => v._id.toString() === cartItem.variantId,
      );
      if (!variant) {
        throw new Error(
          `Variant ${cartItem.variantId} not found on product ${product.title}`,
        );
      }

      if (variant.stock < cartItem.quantity) {
        throw new InsufficientStockError(
          variant.stock,
          cartItem.quantity,
          product.title,
        );
      }

      if (variant.images.length < 2) {
        throw new InsufficientVariantImagesError(product.title);
      }

      orderItems.push({
        productId: product._id.toString(),
        variantId: variant._id.toString(),
        variant_name: variant.variant_name,
        sku: variant.sku,
        title: product.title,
        price: variant.price,
        quantity: cartItem.quantity,
        thumbnail: variant.thumbnail,
      });

      totalAmount += variant.price * cartItem.quantity;
      totalItems += cartItem.quantity;
    }

    // Create order without payment intent ID first
    let order = await this.orderRepository.create({
      userId,
      items: orderItems,
      totalAmount,
      totalItems,
      shippingAddress: {
        street: address.street,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        isDefault: address.isDefault,
      },
      paymentMethod,
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
    });

    // If online payment, create Stripe checkout session
    let checkoutSession: CheckoutSession | undefined;
    if (paymentMethod === "ONLINE") {
      try {
        const session = await this.stripeService.createCheckoutSession(
          orderItems,
          successUrl || "",
          cancelUrl || "",
          {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            userId: userId,
          },
        );

        checkoutSession = {
          id: session.id,
          url: session.url || "",
        };

        // Update order with session ID and expiration
        const sessionExpiresAt = session.expires_at
          ? new Date(session.expires_at * 1000)
          : undefined;
        const updatedOrder = await this.orderRepository.updateSessionId(
          order._id.toString(),
          session.id,
          sessionExpiresAt,
        );
        if (updatedOrder) {
          order = updatedOrder;
        }
      } catch (stripeError: any) {
        // If Stripe fails, delete the order and return error
        await this.orderRepository.deactivateOrder(order._id.toString());
        throw new Error(
          `Failed to create checkout session: ${stripeError.message}`,
        );
      }
    }

    // Clear cart after order creation
    await this.cartRepository.clearCart(cart._id.toString());

    return { order, checkoutSession };
  }

  /**
   * Regenerate payment URL for existing order
   */
  async regeneratePaymentUrl(
    orderId: string,
    userId: string,
    successUrl?: string,
    cancelUrl?: string,
  ): Promise<{ checkoutSession: CheckoutSession }> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError();
    }

    if (order.userId !== userId) {
      throw new Error("Access denied");
    }

    if (order.paymentMethod !== "ONLINE") {
      throw new Error(
        "Payment URL regeneration is only available for online payment orders",
      );
    }

    // Fast-path: DB already knows it's paid
    if (order.paymentStatus === "PAID") {
      throw new OrderAlreadyPaidError(order._id.toString());
    }

    // ── Step 1: Always verify against Stripe before trusting DB state ────────
    // This catches the race condition where the webhook is delayed but Stripe
    // already recorded the payment.
    if (order.sessionId) {
      const { valid, session: stripeSession } = await this.stripeService.isSessionValid(
        order.sessionId,
      );

      // Session still open — return existing URL, no new session needed
      if (valid && stripeSession) {
        return {
          checkoutSession: {
            id: stripeSession.id,
            url: stripeSession.url || "",
          },
        };
      }

      // Stripe says paid but webhook hasn't landed yet → sync DB immediately
      if (stripeSession?.payment_status === "paid") {
        order.paymentStatus = "PAID";
        order.transactionId = stripeSession.payment_intent as string;
        order.paidAt = new Date();
        await order.save();
        throw new OrderAlreadyPaidError(order._id.toString());
      }

      // Session expired without payment — release any stale PROCESSING lock
      // so the user can get a fresh session below
      if (order.paymentStatus === "PROCESSING") {
        order.paymentStatus = "PENDING";
        await order.save();
      }
    }

    // ── Step 2: Lock to prevent concurrent duplicate session creation ─────────
    if (order.paymentStatus === "PROCESSING") {
      throw new PaymentInProgressError();
    }

    order.paymentStatus = "PROCESSING";
    await order.save();

    // ── Step 3: Create new checkout session ───────────────────────────────────
    try {
      const session = await this.stripeService.createCheckoutSession(
        order.items,
        successUrl || "",
        cancelUrl || "",
        {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          userId: userId,
        },
      );

      const checkoutSession = {
        id: session.id,
        url: session.url || "",
      };

      const sessionExpiresAt = session.expires_at
        ? new Date(session.expires_at * 1000)
        : undefined;
      const updatedOrder = await this.orderRepository.updateSessionId(
        order._id.toString(),
        session.id,
        sessionExpiresAt,
      );

      if (!updatedOrder) {
        throw new Error("Failed to update order with new session information");
      }

      return { checkoutSession };
    } catch (stripeError: any) {
      // Release lock so the user can retry
      order.paymentStatus = "PENDING";
      await order.save();
      throw new Error(
        `Failed to create new checkout session: ${stripeError.message}`,
      );
    }
  }

  /**
   * Get user's orders
   */
  async getUserOrders(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ orders: Order[]; total: number }> {
    const allOrders = await this.orderRepository.findByUserId(userId);
    const skip = (page - 1) * limit;
    const orders = allOrders.slice(skip, skip + limit);
    return { orders, total: allOrders.length };
  }

  /**
   * Get order by order number
   */
  async getOrderByOrderNumber(
    orderNumber: string,
    userId?: string,
  ): Promise<Order> {
    const order = await this.orderRepository.findByOrderNumber(orderNumber);
    if (!order) {
      throw new OrderNotFoundError();
    }

    // Check if order belongs to user (if userId provided)
    if (userId && order.userId !== userId) {
      throw new Error("Access denied");
    }

    return order;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string, userId?: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError();
    }

    // Check if order belongs to user (if userId provided)
    if (userId && order.userId !== userId) {
      throw new Error("Access denied");
    }

    return order;
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, userId: string, reason: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError();
    }

    // Check if order belongs to user
    if (order.userId !== userId) {
      throw new Error("Access denied");
    }

    // Check if order can be cancelled
    if (order.orderStatus === "CANCELLED") {
      throw new OrderCannotBeCancelledError(order.orderStatus);
    }

    if (
      order.orderStatus === "SHIPPED" ||
      order.orderStatus === "DELIVERED" ||
      order.orderStatus === "CONFIRMED"
    ) {
      throw new OrderCannotBeCancelledError(order.orderStatus);
    }

    // Prevent double refund
    if (
      order.refundStatus === "INITIATED" ||
      order.refundStatus === "COMPLETED"
    ) {
      order.orderStatus = "CANCELLED";
      order.cancellationReason = reason;
      await order.save();
      return order;
    }

    // ONLINE + PAID → issue refund
    if (
      order.paymentMethod === "ONLINE" &&
      order.paymentStatus === "PAID" &&
      order.transactionId
    ) {
      order.orderStatus = "CANCELLED";
      order.cancellationReason = reason;
      order.refundStatus = "REQUESTED";
      await order.save();

      try {
        const refund = await this.stripeService.createRefundByPaymentIntent(
          order.transactionId,
        );
        order.refundStatus = "INITIATED";
        order.refundId = refund.id;
        order.refundAmount = order.totalAmount;
        await order.save();
      } catch (refundError: any) {
        order.refundStatus = "FAILED";
        await order.save();
        console.error(`Failed to issue refund: ${refundError.message}`);
      }

      return order;
    }

    // COD or ONLINE unpaid → just cancel
    order.orderStatus = "CANCELLED";
    order.cancellationReason = reason;
    await order.save();
    return order;
  }

  /**
   * Get order statistics for user
   */
  async getOrderStats(userId: string): Promise<OrderStats> {
    return (await this.orderRepository.getOrderStats(
      userId,
    )) as unknown as OrderStats;
  }

  /**
   * Get all orders (admin)
   */
  async getAllOrders(
    page: number = 1,
    limit: number = 20,
    status?: string,
  ): Promise<{ orders: Order[]; total: number }> {
    const allOrders = await this.orderRepository.getAllOrders(
      1000,
      0,
      status as any,
    );
    const skip = (page - 1) * limit;
    const orders = allOrders.slice(skip, skip + limit);
    return { orders, total: allOrders.length };
  }

  /**
   * Get payment history for user
   */
  async getPaymentHistory(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ payments: PaymentInfo[]; total: number }> {
    const orders = await this.orderRepository.findByUserId(userId);

    // Extract payment information from orders
    const allPaymentHistory = orders
      .filter(
        (order) =>
          order.paymentMethod === "ONLINE" &&
          (order.sessionId || order.transactionId),
      )
      .map((order) => ({
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        sessionId: order.sessionId,
        transactionId: order.transactionId,
        amount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const skip = (page - 1) * limit;
    const payments = allPaymentHistory.slice(skip, skip + limit);

    return { payments, total: allPaymentHistory.length };
  }

  /**
   * Update order status (admin)
   */
  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    const validStatuses = [
      "PENDING",
      "CONFIRMED",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];
    if (!validStatuses.includes(status)) {
      throw new InvalidOrderStatusError();
    }

    const updatedOrder = await this.orderRepository.updateOrderStatus(
      orderId,
      status as any,
    );
    if (!updatedOrder) {
      throw new OrderNotFoundError();
    }

    return updatedOrder;
  }

  /**
   * Ship order with OTP (admin)
   */
  async shipOrderWithOTP(
    orderId: string,
  ): Promise<{ order: Order; emailSent: boolean }> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new OrderNotFoundError();
    }

    // Check if order is in CONFIRMED status
    if (order.orderStatus !== "CONFIRMED") {
      throw new Error("Order must be in CONFIRMED status to ship");
    }

    // Get user details for email
    const user = await this.userRepository.findById(order.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate 4-digit OTP for delivery confirmation
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const otpExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update order status to SHIPPED and save OTP
    const updatedOrder = await this.orderRepository.updateToShippedWithOTP(
      orderId,
      otp,
      otpExpires,
    );
    if (!updatedOrder) {
      throw new Error("Failed to update order status");
    }

    // Send delivery OTP email
    const emailSent = await emailService.sendDeliveryOTP(
      user.email,
      otp,
      order.orderNumber,
    );

    return { order: updatedOrder, emailSent };
  }

  /**
   * Verify delivery OTP and update status to delivered
   */
  async verifyDeliveryOTP(orderId: string, otp: string): Promise<Order> {
    const updatedOrder = await this.orderRepository.verifyDeliveryOTP(
      orderId,
      otp,
    );
    if (!updatedOrder) {
      throw new Error("Invalid OTP, expired OTP, or order not found");
    }
    return updatedOrder;
  }
}
