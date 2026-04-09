import { Request, Response } from 'express';
import { WishlistService } from '../services/wishlist.service';
import { logger } from '../utils/logger';
import { plainToInstance } from 'class-transformer';
import { WishlistResponseDto, WishlistStatsDto, UserDetailsDto } from '../dtos/wishlist.dto';
import { WishlistNotFoundError, ProductNotFoundError, InsufficientVariantImagesError } from '../utils/errors/wishlist.errors';
import { createPaginatedResponse, parsePaginationParams } from '../utils/pagination';

export class WishlistController {
  private wishlistService: WishlistService;

  constructor() {
    this.wishlistService = new WishlistService();
  }

  async getWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
        });
        return;
      }

      const wishlist = await this.wishlistService.getOrCreateWishlist(userId);

      logger.success(userId, 'getWishlist', `Retrieved wishlist with ${wishlist.items.length} items`);

      const wishlistDto = plainToInstance(WishlistResponseDto, wishlist.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'WISHLIST_RETRIEVED',
        message: 'Wishlist retrieved successfully',
        data: wishlistDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getWishlist', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'WISHLIST_ERROR', message: 'Failed to retrieve wishlist. Please try again.' }
      });
    }
  }

  async addToWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      const { productId } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
        });
        return;
      }

      const updatedWishlist = await this.wishlistService.addToWishlist(userId, productId);

      logger.success(userId, 'addToWishlist', `Added product ${productId} to wishlist`);

      const wishlistDto = plainToInstance(WishlistResponseDto, updatedWishlist.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'ITEM_ADDED',
        message: 'Item added to wishlist successfully',
        data: wishlistDto
      });
    } catch (error: any) {
      if (error instanceof ProductNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' }
        });
        return;
      }
      if (error instanceof InsufficientVariantImagesError) {
        res.status(400).json({
          success: false,
          error: { code: 'INSUFFICIENT_VARIANT_IMAGES', message: error.message }
        });
        return;
      }
      logger.error(req.user?._id?.toString() || 'anonymous', 'addToWishlist', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'ADD_ITEM_ERROR', message: 'Failed to add item to wishlist. Please try again.' }
      });
    }
  }

  async removeFromWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      const { productId } = req.params;
      const productIdStr = Array.isArray(productId) ? productId[0] : productId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
        });
        return;
      }

      const updatedWishlist = await this.wishlistService.removeFromWishlist(userId, productIdStr);

      logger.success(userId, 'removeFromWishlist', `Removed product ${productIdStr} from wishlist`);

      const wishlistDto = plainToInstance(WishlistResponseDto, updatedWishlist.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'ITEM_REMOVED',
        message: 'Item removed from wishlist successfully',
        data: wishlistDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'removeFromWishlist', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'REMOVE_ITEM_ERROR', message: 'Failed to remove item from wishlist. Please try again.' }
      });
    }
  }

  async clearWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
        });
        return;
      }

      const clearedWishlist = await this.wishlistService.clearWishlist(userId);

      logger.success(userId, 'clearWishlist', 'Cleared wishlist');

      const wishlistDto = plainToInstance(WishlistResponseDto, clearedWishlist.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'WISHLIST_CLEARED',
        message: 'Wishlist cleared successfully',
        data: wishlistDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'clearWishlist', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'CLEAR_ERROR', message: 'Failed to clear wishlist. Please try again.' }
      });
    }
  }

  async getWishlistStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
        });
        return;
      }

      const stats = await this.wishlistService.getWishlistStats(userId);

      logger.success(userId, 'getWishlistStats', `Retrieved wishlist stats: ${stats.itemCount} items`);

      const statsDto = plainToInstance(WishlistStatsDto, stats, { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'STATS_RETRIEVED',
        message: 'Wishlist statistics retrieved successfully',
        data: statsDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getWishlistStats', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'STATS_ERROR', message: 'Failed to retrieve statistics. Please try again.' }
      });
    }
  }

  // Admin: Get wishlist by user ID
  async getWishlistByUserId(req: Request, res: Response): Promise<void> {
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

      const wishlist = await this.wishlistService.getWishlistByUserId(userIdStr);

      if (!wishlist) {
        res.status(404).json({
          success: false,
          error: { code: 'WISHLIST_NOT_FOUND', message: 'Wishlist not found for this user' }
        });
        return;
      }

      logger.success(req.user?.username || 'admin', 'getWishlistByUserId', `Retrieved wishlist for user ${userIdStr} with ${wishlist.items.length} items`);

      // Convert to DTO and manually add user details
      const wishlistDto = plainToInstance(WishlistResponseDto, wishlist.toObject(), { excludeExtraneousValues: true });
      
      // Manually add user details if they exist
      if ((wishlist as any).userDetails) {
        (wishlistDto as any).userDetails = (wishlist as any).userDetails;
      }

      res.status(200).json({
        success: true,
        code: 'USER_WISHLIST_RETRIEVED',
        message: 'User wishlist retrieved successfully',
        data: wishlistDto
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'admin', 'getWishlistByUserId', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'WISHLIST_ERROR', message: 'Failed to retrieve user wishlist. Please try again.' }
      });
    }
  }

  // Admin: Get wishlist statistics by user ID
  async getWishlistStatsByUserId(req: Request, res: Response): Promise<void> {
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

      const stats = await this.wishlistService.getWishlistStatsByUserId(userIdStr);

      if (!stats) {
        res.status(404).json({
          success: false,
          error: { code: 'WISHLIST_NOT_FOUND', message: 'Wishlist not found for this user' }
        });
        return;
      }

      logger.success(req.user?.username || 'admin', 'getWishlistStatsByUserId', `Retrieved wishlist stats for user ${userIdStr}`);

      // Convert to DTO and manually add user details if they exist
      const statsDto = plainToInstance(WishlistStatsDto, stats, { excludeExtraneousValues: true });
      
      // Manually add user details if they exist
      if (stats.userDetails) {
        (statsDto as any).userDetails = stats.userDetails;
      }

      res.status(200).json({
        success: true,
        code: 'USER_WISHLIST_STATS_RETRIEVED',
        message: 'User wishlist statistics retrieved successfully',
        data: statsDto
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'admin', 'getWishlistStatsByUserId', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'STATS_ERROR', message: 'Failed to retrieve user wishlist statistics. Please try again.' }
      });
    }
  }

  // Admin: Get all users with wishlists
  async getAllUsersWithWishlists(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit } = parsePaginationParams(req.query as any, 20, 100);
      const { search } = req.query;

      const result = await this.wishlistService.getAllUsersWithWishlists(page, limit, search as string);

      const paginatedResponse = createPaginatedResponse(result.users, result.total, page, limit);

      logger.success(req.user?.username || 'admin', 'getAllUsersWithWishlists', `Retrieved ${result.users.length} users with wishlists (page ${page}, limit ${limit})`);

      res.status(200).json({
        success: true,
        code: 'ALL_WISHLISTS_RETRIEVED',
        message: 'All users with wishlists retrieved successfully',
        data: paginatedResponse
      });
    } catch (error: any) {
      logger.error(req.user?.username || 'admin', 'getAllUsersWithWishlists', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'WISHLIST_ERROR', message: 'Failed to retrieve users with wishlists. Please try again.' }
      });
    }
  }
}
