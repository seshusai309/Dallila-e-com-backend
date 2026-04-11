import { Request, Response, NextFunction } from 'express';
import { CartService } from '../services/cart.service';
import { logger } from '../utils/logger';
import { plainToInstance } from 'class-transformer';
import { CartResponseDto, CartStatsDto } from '../dtos/cart.dto';
import { createPaginatedResponse, parsePaginationParams } from '../utils/pagination';
import { CartNotFoundError, ProductNotFoundError, InsufficientStockError } from '../utils/errors/cart.errors';
import { Cart } from '../models/Cart';

export class CartController {
  private cartService: CartService;

  constructor() {
    this.cartService = new CartService();
  }

  // Get or create cart for user/guest
  private async getOrCreateCart(req: Request) {
    const userId = req.user?._id?.toString();
    // Only allow authenticated users
    if (!userId) {
      throw new Error('User authentication required');
    }

    return await this.cartService.getOrCreateCart(userId);
  }

  // Get cart
  async getCart(req: Request, res: Response): Promise<void> {
    try {
      // Get or create cart using the same logic as addToCart
      const cart = await this.getOrCreateCart(req);

      logger.success(req.user?._id?.toString() || 'anonymous', 'getCart', `Retrieved cart with ${cart.items.length} items`);

      const cartDto = plainToInstance(CartResponseDto, cart.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'CART_RETRIEVED',
        message: 'Cart retrieved successfully',
        data: cartDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getCart', `Failed to get cart: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'CART_ERROR',
          message: 'Failed to retrieve cart. Please try again.'
        }
      });
    }
  }

  // Add item to cart
  async addToCart(req: Request, res: Response): Promise<void> {
    try {
      const { productId, quantity = 1 } = req.body;

      // Get or create cart
      const cart = await this.getOrCreateCart(req);

      const updatedCart = await this.cartService.addToCart(cart._id.toString(), productId, quantity);

      logger.success(req.user?._id?.toString() || 'anonymous', 'addToCart', `Added ${quantity} items to cart`);

      const cartDto = plainToInstance(CartResponseDto, updatedCart?.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'ITEM_ADDED',
        message: 'Item added to cart successfully',
        data: cartDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'addToCart', `Failed to add item to cart: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'ADD_TO_CART_ERROR',
          message: 'Failed to add item to cart. Please try again.'
        }
      });
    }
  }

  // Update item quantity in cart
  async updateCartItem(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const productIdStr = Array.isArray(productId) ? productId[0] : productId;
      const { quantity } = req.body;

      // Get cart
      const cart = await this.getOrCreateCart(req);

      // Update cart item
      const updatedCart = await this.cartService.updateCartItem(cart._id.toString(), productIdStr, quantity);

      logger.success(req.user?._id?.toString() || 'anonymous', 'updateCartItem', `Updated quantity for product ${productIdStr} to ${quantity}`);

      const cartDto = plainToInstance(CartResponseDto, updatedCart.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'CART_ITEM_UPDATED',
        message: 'Cart item updated successfully',
        data: cartDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'updateCartItem', `Failed to update cart item: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_CART_ERROR',
          message: 'Failed to update cart item. Please try again.'
        }
      });
    }
  }

  // Update item quantity in cart by productId
  async updateCartItemByProduct(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const productIdStr = Array.isArray(productId) ? productId[0] : productId;
      const { quantity } = req.body;

      if (!quantity || quantity < 1) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QUANTITY',
            message: 'Quantity must be at least 1'
          }
        });
        return;
      }

      // Get cart
      const cart = await this.getOrCreateCart(req);

      // Update cart item by productId (will update first variant found)
      const updatedCart = await this.cartService.updateCartItemByProduct(cart._id.toString(), productIdStr, quantity);

      if (!updatedCart) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CART_ITEM_NOT_FOUND',
            message: 'Item not found in cart'
          }
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'updateCartItemByProduct', `Updated quantity for product ${productIdStr} to ${quantity}`);

      const cartDto = plainToInstance(CartResponseDto, updatedCart.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'ITEM_UPDATED',
        message: 'Cart item updated successfully',
        data: cartDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'updateCartItemByProduct', `Failed to update cart item: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_CART_ERROR',
          message: 'Failed to update cart item. Please try again.'
        }
      });
    }
  }

  // Remove item from cart
  async removeFromCart(req: Request, res: Response): Promise<void> {
    try {
      const { productId } = req.params;
      const productIdStr = Array.isArray(productId) ? productId[0] : productId;

      // Get cart
      const cart = await this.getOrCreateCart(req);

      // Remove item from cart
      const updatedCart = await this.cartService.removeFromCart(cart._id.toString(), productIdStr);

      if (!updatedCart) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CART_ITEM_NOT_FOUND',
            message: 'Item not found in cart'
          }
        });
        return;
      }

      logger.success(req.user?._id?.toString() || 'anonymous', 'removeFromCart', `Removed product ${productIdStr} from cart`);

      const cartDto = plainToInstance(CartResponseDto, updatedCart.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'ITEM_REMOVED',
        message: 'Item removed from cart successfully',
        data: cartDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'removeFromCart', `Failed to remove item from cart: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'REMOVE_ITEM_ERROR',
          message: 'Failed to remove item from cart. Please try again.'
        }
      });
    }
  }

  // Clear cart
  async clearCart(req: Request, res: Response): Promise<void> {
    try {
      // Get cart
      const cart = await this.getOrCreateCart(req);

      // Clear cart
      const clearedCart = await this.cartService.clearCart(cart._id.toString());

      logger.success(req.user?._id?.toString() || 'anonymous', 'clearCart', 'Cleared cart');

      const cartDto = plainToInstance(CartResponseDto, clearedCart?.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'CART_CLEARED',
        message: 'Cart cleared successfully',
        data: cartDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'clearCart', `Failed to clear cart: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'CLEAR_CART_ERROR',
          message: 'Failed to clear cart. Please try again.'
        }
      });
    }
  }

  // Get cart statistics
  async getCartStats(req: Request, res: Response): Promise<void> {
    try {
      // Get cart
      const cart = await this.getOrCreateCart(req);

      // Get statistics
      const stats = await this.cartService.getCartStats(cart._id.toString());

      logger.success(req.user?._id?.toString() || 'anonymous', 'getCartStats', `Retrieved cart stats`);

      const statsDto = plainToInstance(CartStatsDto, stats, { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'CART_STATS_RETRIEVED',
        message: 'Cart statistics retrieved successfully',
        data: statsDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getCartStats', `Failed to get cart stats: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'CART_STATS_ERROR',
          message: 'Failed to retrieve cart statistics. Please try again.'
        }
      });
    }
  }

  // Admin: Get cart by user ID
  async getCartByUserId(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const userIdStr = Array.isArray(userId) ? userId[0] : userId;

      if (!userIdStr) {
        res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'User ID is required' }
        });
        return;
      }

      const cart = await this.cartService.getCartByUserIdAdmin(userIdStr);

      if (!cart) {
        res.status(404).json({
          success: false,
          error: { code: 'CART_NOT_FOUND', message: 'Cart not found for this user' }
        });
        return;
      }

      logger.success(req.user?.username || 'admin', 'getCartByUserId', `Retrieved cart for user ${userIdStr} with ${cart.items.length} items`);

      // Convert to DTO and manually add user details
      const cartDto = plainToInstance(CartResponseDto, cart.toObject(), { excludeExtraneousValues: true });
      
      // Manually add user details if they exist
      if ((cart as any).userDetails) {
        (cartDto as any).userDetails = (cart as any).userDetails;
      }

      res.status(200).json({
        success: true,
        code: 'USER_CART_RETRIEVED',
        message: 'User cart retrieved successfully',
        data: cartDto
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'admin', 'getCartByUserId', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'CART_ERROR', message: 'Failed to retrieve user cart. Please try again.' }
      });
    }
  }

  // Admin: Get all users with carts
  async getAllUsersWithCarts(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit } = parsePaginationParams(req.query as any, 20, 100);
      const { search } = req.query;

      const result = await this.cartService.getAllUsersWithCarts(page, limit, search as string);

      const paginatedResponse = createPaginatedResponse(result.users, result.total, page, limit);

      logger.success(req.user?.username || 'admin', 'getAllUsersWithCarts', `Retrieved ${result.users.length} users with carts (page ${page}, limit ${limit})`);

      res.status(200).json({
        success: true,
        code: 'ALL_CARTS_RETRIEVED',
        message: 'All users with carts retrieved successfully',
        data: paginatedResponse
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'admin', 'getAllUsersWithCarts', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'CART_ERROR', message: 'Failed to retrieve users with carts. Please try again.' }
      });
    }
  }

  // Get all guest carts (admin only)
  async getAllGuestCarts(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user;

      const { page, limit } = parsePaginationParams(req.query as any, 20, 50);

      // Get all guest carts (without pagination for total count)
      // const allGuestCarts = await this.cartService.getAllGuestCarts();
      const allGuestCarts: Cart[] = []; // Guest carts feature disabled
      
      // Apply pagination
      const totalRecords = allGuestCarts.length;
      const skip = (page - 1) * limit;
      const data = allGuestCarts.slice(skip, skip + limit);
      
      // Transform to DTOs
      const cartsDto = data.map(cart => plainToInstance(CartResponseDto, cart.toObject(), { excludeExtraneousValues: true }));

      logger.success(user?.username || 'anonymous', 'getAllGuestCarts', `Retrieved ${data.length} guest carts (page ${page} of ${Math.ceil(totalRecords / limit)})`);

      const paginatedResponse = createPaginatedResponse(cartsDto, totalRecords, page, limit);

      res.status(200).json({
        success: true,
        code: 'GUEST_CARTS_RETRIEVED',
        message: 'Guest carts retrieved successfully',
        ...paginatedResponse
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'anonymous', 'getAllGuestCarts', `Failed to get guest carts: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'GUEST_CARTS_ERROR',
          message: 'Failed to retrieve guest carts. Please try again.'
        }
      });
    }
  }

  // Validate cart items (check stock availability)
  async validateCart(req: Request, res: Response): Promise<void> {
    try {
      const cart = await this.getOrCreateCart(req);
      const result = await this.cartService.validateCart(cart._id.toString());

      logger.success(req.user?._id?.toString() || 'anonymous', 'validateCart', `Validated cart: ${result.allItemsAvailable ? 'All items available' : 'Some items unavailable'}`);

      res.status(200).json({
        success: true,
        code: 'CART_VALIDATED',
        message: 'Cart validation completed',
        data: {
          allItemsAvailable: result.allItemsAvailable,
          validationResults: result.validationResults,
          cartTotal: result.cartTotal
        }
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'validateCart', `Failed to validate cart: ${error.message}`);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Failed to validate cart. Please try again.'
        }
      });
    }
  }
}
