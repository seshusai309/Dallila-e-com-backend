import { WishlistRepository } from '../repository/WishlistRepository';
import { ProductRepository } from '../repository/ProductRepository';
import { Wishlist } from '../models/Wishlist';
import { WishlistNotFoundError, ProductNotFoundError } from '../utils/errors/wishlist.errors';

export interface WishlistItemInput {
  productId: string;
  title: string;
  price: number;
  thumbnail?: string;
  addedAt?: Date;
}

export interface WishlistStats {
  itemCount: number;
  totalValue: number;
  uniqueCategories?: number;
}

export class WishlistService {
  private wishlistRepository: WishlistRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.wishlistRepository = new WishlistRepository();
    this.productRepository = new ProductRepository();
  }

  /**
   * Get or create wishlist for user
   */
  async getOrCreateWishlist(userId: string): Promise<Wishlist> {
    let wishlist = await this.wishlistRepository.findByUserId(userId);

    if (!wishlist) {
      wishlist = await this.wishlistRepository.create({
        userId,
        items: [],
        isActive: true,
      });
    }

    return wishlist;
  }

  /**
   * Get wishlist by user ID (admin version with user details)
   */
  async getWishlistByUserId(userId: string): Promise<Wishlist | null> {
    const wishlist = await this.wishlistRepository.findByUserId(userId);
    if (!wishlist) {
      return null;
    }

    // Populate user details
    const { User } = await import('../models/User');
    const user = await User.findById(userId).select('username email phoneNumber').lean();
    
    // Add user details to wishlist object
    (wishlist as any).userDetails = {
      userName: user?.username || 'Unknown',
      userEmail: user?.email || 'Unknown',
      userPhone: user?.phoneNumber || 'Not provided'
    };

    return wishlist;
  }

  /**
   * Get wishlist by ID
   */
  async getWishlistById(wishlistId: string): Promise<Wishlist> {
    const wishlist = await this.wishlistRepository.findById(wishlistId);
    if (!wishlist) {
      throw new WishlistNotFoundError();
    }
    return wishlist;
  }

  /**
   * Add item to wishlist
   */
  async addToWishlist(userId: string, productId: string): Promise<Wishlist> {
    // Get product details
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new ProductNotFoundError();
    }

    // Get or create wishlist
    const wishlist = await this.getOrCreateWishlist(userId);

    // Add item to wishlist
    const wishlistItem: WishlistItemInput = {
      productId: product._id.toString(),
      title: product.title,
      price: product.price ?? 0,
      thumbnail: product.thumbnail || product.images?.[0]?.src || '',
      addedAt: new Date(),
    };

    // Ensure thumbnail is always a string for repository
    const repositoryItem = {
      productId: wishlistItem.productId,
      title: wishlistItem.title,
      price: wishlistItem.price,
      thumbnail: wishlistItem.thumbnail || '', // Ensure non-empty string
    };

    const updatedWishlist = await this.wishlistRepository.addItem(wishlist._id.toString(), repositoryItem);
    if (!updatedWishlist) {
      throw new WishlistNotFoundError();
    }

    return updatedWishlist;
  }

  /**
   * Remove item from wishlist
   */
  async removeFromWishlist(userId: string, productId: string): Promise<Wishlist> {
    const wishlist = await this.getOrCreateWishlist(userId);

    const updatedWishlist = await this.wishlistRepository.removeItem(wishlist._id.toString(), productId);
    if (!updatedWishlist) {
      throw new WishlistNotFoundError();
    }

    return updatedWishlist;
  }

  /**
   * Clear wishlist
   */
  async clearWishlist(userId: string): Promise<Wishlist> {
    const wishlist = await this.getOrCreateWishlist(userId);

    const clearedWishlist = await this.wishlistRepository.clearWishlist(wishlist._id.toString());
    if (!clearedWishlist) {
      throw new WishlistNotFoundError();
    }

    return clearedWishlist;
  }

  /**
   * Get wishlist statistics
   */
  async getWishlistStats(userId: string): Promise<WishlistStats> {
    const wishlist = await this.getOrCreateWishlist(userId);

    const stats = await this.wishlistRepository.getWishlistStats(wishlist._id.toString());
    if (!stats) {
      throw new WishlistNotFoundError();
    }

    return {
      itemCount: stats.itemCount,
      totalValue: stats.totalValue,
    };
  }

  /**
   * Get wishlist statistics by user ID (admin version - doesn't create if not found)
   */
  async getWishlistStatsByUserId(userId: string): Promise<WishlistStats & { userDetails?: { userName: string; userEmail: string; userPhone: string } } | null> {
    const wishlist = await this.wishlistRepository.findByUserId(userId);
    if (!wishlist) {
      return null;
    }

    const stats = await this.wishlistRepository.getWishlistStats(wishlist._id.toString());
    if (!stats) {
      return null;
    }

    // Get user details
    const { User } = await import('../models/User');
    const user = await User.findById(userId).select('username email phoneNumber').lean();

    return {
      itemCount: stats.itemCount,
      totalValue: stats.totalValue,
      userDetails: {
        userName: user?.username || 'Unknown',
        userEmail: user?.email || 'Unknown',
        userPhone: user?.phoneNumber || 'Not provided'
      }
    };
  }

  /**
   * Get all users with wishlists (admin only)
   */
  async getAllUsersWithWishlists(page: number = 1, limit: number = 20, search?: string): Promise<{
    users: Array<{ userId: string; userName: string; userEmail: string; userPhone: string; itemCount: number; totalValue: number; lastUpdated: Date }>;
    total: number;
  }> {
    return await this.wishlistRepository.getAllUsersWithWishlists(page, limit, search);
  }
}
