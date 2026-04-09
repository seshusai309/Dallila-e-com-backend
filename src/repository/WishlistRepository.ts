import { Wishlist, WishlistModel } from '../models/Wishlist';
import { logger } from '../utils/logger';

export class WishlistRepository {
  // Create new wishlist
  async create(wishlistData: Partial<Wishlist>): Promise<Wishlist> {
    try {
      const wishlist = new WishlistModel(wishlistData);
      return await wishlist.save();
    } catch (error: any) {
      logger.error('WishlistRepository', 'create', `Failed to create wishlist: ${error.message}`);
      throw error;
    }
  }

  // Find wishlist by ID
  async findById(id: string): Promise<Wishlist | null> {
    try {
      return await WishlistModel.findById(id);
    } catch (error: any) {
      logger.error('WishlistRepository', 'findById', `Failed to find wishlist by ID: ${error.message}`);
      throw error;
    }
  }

  // Find wishlist by user ID
  async findByUserId(userId: string): Promise<Wishlist | null> {
    try {
      return await WishlistModel.findOne({ userId, isActive: true });
    } catch (error: any) {
      logger.error('WishlistRepository', 'findByUserId', `Failed to find wishlist by user ID: ${error.message}`);
      throw error;
    }
  }

  // Get or create wishlist for user only
  async getOrCreateWishlist(userId: string): Promise<Wishlist> {
    try {
      let wishlist = await this.findByUserId(userId);

      if (!wishlist) {
        wishlist = await this.create({
          userId,
          items: [],
          isActive: true
        });
      }

      return wishlist;
    } catch (error: any) {
      logger.error('WishlistRepository', 'getOrCreateWishlist', `Failed to get or create wishlist: ${error.message}`);
      throw error;
    }
  }

  // Add item to wishlist
  async addItem(wishlistId: string, item: {
    productId: string;
    title: string;
    price: number;
    thumbnail: string;
  }): Promise<Wishlist | null> {
    try {
      const wishlist = await this.findById(wishlistId);
      if (!wishlist) {
        return null;
      }

      // Check if item already exists
      const existingItem = wishlist.items.find(wishlistItem => 
        wishlistItem.productId === item.productId
      );

      if (!existingItem) {
        wishlist.items.push({
          ...item,
          addedAt: new Date()
        });
        return await wishlist.save();
      }

      return wishlist; // Item already exists
    } catch (error: any) {
      logger.error('WishlistRepository', 'addItem', `Failed to add item to wishlist: ${error.message}`);
      throw error;
    }
  }

  // Remove item from wishlist
  async removeItem(wishlistId: string, productId: string): Promise<Wishlist | null> {
    try {
      const wishlist = await this.findById(wishlistId);
      if (!wishlist) {
        return null;
      }

      wishlist.items = wishlist.items.filter(item => item.productId !== productId);
      return await wishlist.save();
    } catch (error: any) {
      logger.error('WishlistRepository', 'removeItem', `Failed to remove item from wishlist: ${error.message}`);
      throw error;
    }
  }

  // Clear wishlist
  async clearWishlist(wishlistId: string): Promise<Wishlist | null> {
    try {
      const wishlist = await this.findById(wishlistId);
      if (!wishlist) {
        return null;
      }

      wishlist.items = [];
      return await wishlist.save();
    } catch (error: any) {
      logger.error('WishlistRepository', 'clearWishlist', `Failed to clear wishlist: ${error.message}`);
      throw error;
    }
  }

  // Get wishlist statistics
  async getWishlistStats(wishlistId: string): Promise<{ itemCount: number; totalValue: number } | null> {
    try {
      const wishlist = await this.findById(wishlistId);
      if (!wishlist) {
        return null;
      }

      const totalValue = wishlist.items.reduce((sum, item) => sum + item.price, 0);

      return {
        itemCount: wishlist.items.length,
        totalValue
      };
    } catch (error: any) {
      logger.error('WishlistRepository', 'getWishlistStats', `Failed to get wishlist stats: ${error.message}`);
      throw error;
    }
  }

  // Deactivate wishlist
  async deactivateWishlist(wishlistId: string): Promise<boolean> {
    try {
      const result = await WishlistModel.findByIdAndUpdate(
        wishlistId,
        { isActive: false },
        { new: true }
      );
      return result !== null;
    } catch (error: any) {
      logger.error('WishlistRepository', 'deactivateWishlist', `Failed to deactivate wishlist: ${error.message}`);
      throw error;
    }
  }

  // Get all users with wishlists (admin only)
  async getAllUsersWithWishlists(page: number = 1, limit: number = 20, search?: string): Promise<{
    users: Array<{ userId: string; userName: string; userEmail: string; userPhone: string; itemCount: number; totalValue: number; lastUpdated: Date }>;
    total: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      // Build query for search functionality
      const query: any = { isActive: true };
      
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        
        // Import User model dynamically to avoid circular dependency
        const { User } = await import('../models/User');
        
        // Find users that match the search criteria
        const matchingUsers = await User.find({
          $or: [
            { username: searchRegex },
            { email: searchRegex }
          ]
        }).select('_id').lean();
        
        // Get user IDs from matching users
        const userIds = matchingUsers.map(user => user._id.toString());
        
        // Add to query - only include wishlists from matching users
        if (userIds.length > 0) {
          query.userId = { $in: userIds };
        } else {
          // If no users match, return empty result
          return { users: [], total: 0 };
        }
      }
      
      // Get total count
      const total = await WishlistModel.countDocuments(query);
      
      // Get wishlists with pagination
      const wishlists = await WishlistModel.find(query)
        .select('userId items updatedAt')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Get unique user IDs from the paginated results
      const userIds = [...new Set(wishlists.map(w => w.userId))];

      // Import User model dynamically to avoid circular dependency
      const { User } = await import('../models/User');
      
      // Get user data for all wishlist owners
      const users = await User.find({ _id: { $in: userIds } })
        .select('username email phoneNumber')
        .lean();

      // Create a map for quick lookup
      const userMap = new Map(
        users.map(user => [user._id.toString(), user])
      );

      // Transform the data
      const transformedUsers = wishlists.map(wishlist => {
        const user = userMap.get(wishlist.userId.toString());
        
        return {
          userId: wishlist.userId.toString(),
          userName: user?.username || 'Unknown',
          userEmail: user?.email || 'Unknown',
          userPhone: user?.phoneNumber || 'Not provided',
          itemCount: wishlist.items.length,
          totalValue: wishlist.items.reduce((sum, item) => sum + item.price, 0),
          lastUpdated: wishlist.updatedAt
        };
      });

      return { users: transformedUsers, total };
    } catch (error: any) {
      logger.error('WishlistRepository', 'getAllUsersWithWishlists', `Failed to get all users with wishlists: ${error.message}`);
      throw error;
    }
  }
}
