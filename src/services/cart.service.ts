import { CartRepository } from '../repository/CartRepository';
import { ProductRepository } from '../repository/ProductRepository';
import { Cart, CartItem } from '../models/Cart';
import { CartNotFoundError, ProductNotFoundError, InsufficientStockError, InsufficientVariantImagesError } from '../utils/errors/cart.errors';

export interface CartItemInput {
  productId: string;
  variantId: string;
  variant_name: 'gold' | 'silver' | 'rose gold';
  sku: string;
  title: string;
  price: number;
  quantity: number;
  thumbnail: string;
  addedAt?: Date;
}

export interface CartStats {
  totalItems: number;
  totalAmount: number;
  itemCount: number;
}

export interface ValidationResult {
  productId: string;
  variantId: string;
  title: string;
  available: boolean;
  reason?: string;
  availableStock?: number;
  requestedQuantity?: number;
  currentPrice?: number;
  stock?: number;
}

export interface CartValidationResult {
  allItemsAvailable: boolean;
  validationResults: ValidationResult[];
  cartTotal: number;
}

export class CartService {
  private cartRepository: CartRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.cartRepository = new CartRepository();
    this.productRepository = new ProductRepository();
  }

  /**
   * Get or create cart for user/guest
   */
  async getOrCreateCart(userId?: string, guestId?: string): Promise<Cart> {
    // return await this.cartRepository.getOrCreateCart(userId, guestId);
    return await this.cartRepository.getOrCreateCart(userId);
  }

  /**
   * Get cart by ID
   */
  async getCartById(cartId: string): Promise<Cart> {
    const cart = await this.cartRepository.findById(cartId);
    if (!cart) {
      throw new CartNotFoundError();
    }
    return cart;
  }

  /**
   * Get cart for user
   */
  async getCartByUserId(userId: string): Promise<Cart | null> {
    return await this.cartRepository.findByUserId(userId);
  }

  /**
   * Get cart with items (creates if doesn't exist)
   */
  async getOrCreateUserCart(userId?: string, guestId?: string): Promise<Cart> {
    let cart: Cart | null = null;

    if (userId) {
      cart = await this.cartRepository.findByUserId(userId);
    }

    // if (!cart && guestId) {
    //   cart = await this.cartRepository.findById(guestId);
    // }

    if (!cart) {
      cart = await this.cartRepository.create({
        userId,
        items: [],
        totalAmount: 0,
        totalItems: 0,
      });
    }

    return cart;
  }

  /**
   * Add item to cart
   */
  async addToCart(cartId: string, productId: string, variantId: string, quantity: number = 1): Promise<Cart> {
    // Get product details
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundError();
    }

    // Find the specified variant
    const variant = product.variants.find(v => v._id.toString() === variantId);
    if (!variant) {
      throw new Error(`Variant ${variantId} not found on product`);
    }

    if (variant.stock < quantity) {
      throw new InsufficientStockError(variant.stock, quantity);
    }

    if (variant.images.length < 2) {
      throw new InsufficientVariantImagesError();
    }

    // Create cart item
    const cartItem: CartItem = {
      productId: product._id.toString(),
      variantId: variant._id.toString(),
      variant_name: variant.variant_name,
      sku: variant.sku,
      title: product.title,
      price: variant.price,
      quantity,
      thumbnail: variant.thumbnail || variant.images?.[0]?.src || '',
      addedAt: new Date(),
    };

    // Add item to cart
    const updatedCart = await this.cartRepository.addItem(cartId, cartItem);
    if (!updatedCart) {
      throw new CartNotFoundError();
    }

    return updatedCart;
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(cartId: string, productId: string, variantId: string, quantity: number): Promise<Cart> {
    // Check if product exists and has enough stock
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundError();
    }

    const variant = product.variants.find(v => v._id.toString() === variantId);
    if (!variant) {
      throw new Error(`Variant ${variantId} not found on product`);
    }

    if (variant.stock < quantity) {
      throw new InsufficientStockError(variant.stock, quantity);
    }

    // Update cart item
    const updatedCart = await this.cartRepository.updateItemQuantity(cartId, productId, variantId, quantity);
    if (!updatedCart) {
      throw new CartNotFoundError('Cart item not found');
    }

    return updatedCart;
  }

  /**
   * Update cart item quantity by productId (updates first variant found)
   */
  async updateCartItemByProduct(cartId: string, productId: string, quantity: number): Promise<Cart> {
    // Check if product exists
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundError();
    }

    // Find the first variant of this product in the cart
    const cart = await this.cartRepository.findById(cartId);
    if (!cart) {
      throw new CartNotFoundError('Cart not found');
    }

    const cartItem = cart.items.find(item => item.productId === productId);
    if (!cartItem) {
      throw new CartNotFoundError('Cart item not found');
    }

    // Check if the variant has enough stock
    const variant = product.variants.find(v => v._id.toString() === cartItem.variantId);
    if (!variant) {
      throw new Error(`Variant ${cartItem.variantId} not found on product`);
    }

    if (variant.stock < quantity) {
      throw new InsufficientStockError(variant.stock, quantity);
    }

    // Update cart item
    const updatedCart = await this.cartRepository.updateItemQuantity(cartId, productId, cartItem.variantId, quantity);
    if (!updatedCart) {
      throw new CartNotFoundError('Cart item not found');
    }

    return updatedCart;
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(cartId: string, productId: string, variantId: string): Promise<Cart> {
    const updatedCart = await this.cartRepository.removeItem(cartId, productId, variantId);
    if (!updatedCart) {
      throw new CartNotFoundError('Item not found in cart');
    }
    return updatedCart;
  }

  /**
   * Clear cart
   */
  async clearCart(cartId: string): Promise<Cart> {
    const clearedCart = await this.cartRepository.clearCart(cartId);
    if (!clearedCart) {
      throw new CartNotFoundError();
    }
    return clearedCart;
  }

  /**
   * Get cart statistics
   */
  async getCartStats(cartId: string): Promise<CartStats> {
    const stats = await this.cartRepository.getCartStats(cartId);
    if (!stats) {
      throw new CartNotFoundError();
    }
    return stats as CartStats;
  }

  /**
   * Get all guest carts (admin only)
   */
  // async getAllGuestCarts(): Promise<Cart[]> {
  //   return await this.cartRepository.findAllGuestCarts();
  // }

  /**
   * Merge guest cart with user cart
   */
  // async mergeGuestCart(guestId: string, userId: string): Promise<Cart> {
  //   const mergedCart = await this.cartRepository.mergeGuestCart(guestId, userId);
  //   if (!mergedCart) {
  //     throw new CartNotFoundError('Guest cart not found');
  //   }
  //   return mergedCart;
  // }

  /**
   * Validate cart items (check stock availability)
   */
  async validateCart(cartId: string): Promise<CartValidationResult> {
    const cart = await this.cartRepository.findById(cartId);
    if (!cart) {
      throw new CartNotFoundError();
    }

    const validationResults: ValidationResult[] = [];

    for (const item of cart.items) {
      const product = await this.productRepository.findById(item.productId);

      if (!product) {
        validationResults.push({
          productId: item.productId,
          variantId: item.variantId,
          title: item.title,
          available: false,
          reason: 'Product not found',
        });
        continue;
      }

      const variant = product.variants.find(v => v._id.toString() === item.variantId);

      if (!variant) {
        validationResults.push({
          productId: item.productId,
          variantId: item.variantId,
          title: item.title,
          available: false,
          reason: 'Variant not found',
        });
      } else if (variant.stock < item.quantity) {
        validationResults.push({
          productId: item.productId,
          variantId: item.variantId,
          title: item.title,
          available: false,
          reason: 'Insufficient stock',
          availableStock: variant.stock,
          requestedQuantity: item.quantity,
        });
      } else {
        validationResults.push({
          productId: item.productId,
          variantId: item.variantId,
          title: item.title,
          available: true,
          currentPrice: variant.price,
          stock: variant.stock,
        });
      }
    }

    const allItemsAvailable = validationResults.every((result) => result.available);

    return {
      allItemsAvailable,
      validationResults,
      cartTotal: cart.totalAmount,
    };
  }

  /**
   * Get cart by user ID (admin version with user details)
   */
  async getCartByUserIdAdmin(userId: string): Promise<Cart | null> {
    const cart = await this.cartRepository.findByUserId(userId);
    if (!cart) {
      return null;
    }

    // Populate user details
    const { User } = await import('../models/User');
    const user = await User.findById(userId).select('username email phoneNumber').lean();
    
    // Add user details to cart object
    (cart as any).userDetails = {
      userName: user?.username || 'Unknown',
      userEmail: user?.email || 'Unknown',
      userPhone: user?.phoneNumber || 'Not provided'
    };

    return cart;
  }

  /**
   * Get all users with carts (admin only)
   */
  async getAllUsersWithCarts(page: number = 1, limit: number = 20, search?: string): Promise<{
    users: Array<{ userId: string; userName: string; userEmail: string; userPhone: string; itemCount: number; totalAmount: number; lastUpdated: Date }>;
    total: number;
  }> {
    return await this.cartRepository.getAllUsersWithCarts(page, limit, search);
  }
}
