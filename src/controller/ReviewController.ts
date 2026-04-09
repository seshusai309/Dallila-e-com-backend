import { Request, Response } from 'express';
import { ReviewRepository } from '../repository/ReviewRepository';
import { ProductRepository } from '../repository/ProductRepository';
import { UserRepository } from '../repository/UserRepository';
import { UserRole } from '../models/User';
import { logger } from '../utils/logger';
import { plainToInstance } from 'class-transformer';
import { ReviewResponseDto, ReviewWithDetailsDto, ReviewListResponseDto } from '../dtos/review.dto';
import mongoose from 'mongoose';

export class ReviewController {
  private reviewRepository: ReviewRepository;
  private productRepository: ProductRepository;
  private userRepository: UserRepository;

  constructor() {
    this.reviewRepository = new ReviewRepository();
    this.productRepository = new ProductRepository();
    this.userRepository = new UserRepository();
  }

  // Create review for a product
  createReview = async (req: Request, res: Response): Promise<void> => {
    try {
      const { productId } = req.params;
      const productIdStr = Array.isArray(productId) ? productId[0] : productId;
      const { rating, comment } = req.body;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({ 
          success: false,
          code: 'UNAUTHORIZED',
          message: 'User not authenticated' 
        });
        return;
      }

      // Check if product exists
      const product = await this.productRepository.findById(productIdStr);
      if (!product) {
        res.status(404).json({ 
          success: false,
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found' 
        });
        return;
      }

      // Check if user has already reviewed this product
      const existingReview = await this.reviewRepository.checkUserReview(productIdStr, userId.toString());
      if (existingReview) {
        res.status(400).json({ 
          success: false,
          code: 'REVIEW_EXISTS',
          message: 'You have already reviewed this product' 
        });
        return;
      }

      // Get user details
      const user = await this.userRepository.findById(userId.toString());
      if (!user) {
        res.status(404).json({ 
          success: false,
          code: 'USER_NOT_FOUND',
          message: 'User not found' 
        });
        return;
      }

      const reviewData = {
        productId: new mongoose.Types.ObjectId(productIdStr),
        userId: new mongoose.Types.ObjectId(userId),
        rating,
        comment,
        reviewerName: user.username,
        reviewerEmail: user.email
      };

      const review = await this.reviewRepository.create(reviewData);

      logger.success(userId.toString(), 'createReview', `Created review for product ${productIdStr}`);

      const reviewDto = plainToInstance(ReviewResponseDto, review.toObject(), { excludeExtraneousValues: true });

      res.status(201).json({
        success: true,
        code: 'REVIEW_CREATED',
        message: 'Review created successfully',
        data: reviewDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'createReview', `Failed to create review: ${error.message}`);
      res.status(500).json({ 
        success: false,
        code: 'REVIEW_CREATE_ERROR',
        message: 'Failed to create review. Please try again.',
        error: error.message 
      });
    }
  };

  // Get reviews for a product with pagination
  getProductReviews = async (req: Request, res: Response): Promise<void> => {
    try {
      const { productId } = req.params;
      const productIdStr = Array.isArray(productId) ? productId[0] : productId;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const sort = req.query.sort as string || 'newest';

      // Check if product exists
      const product = await this.productRepository.findById(productIdStr);
      if (!product) {
        res.status(404).json({ 
          success: false,
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found' 
        });
        return;
      }

      const { reviews, total, pages } = await this.reviewRepository.findByProductId(
        productIdStr, 
        page, 
        limit, 
        sort
      );

      logger.success(req.user?._id?.toString() || 'anonymous', 'getProductReviews', `Retrieved ${reviews.length} reviews for product ${productIdStr}`);

      // Create DTOs first and add isEditable field
      const reviewsDto = plainToInstance(ReviewWithDetailsDto, reviews.map(review => review.toObject()), { excludeExtraneousValues: true });
      
      // Add isEditable field based on user ownership
      const currentUserId = req.user?._id?.toString();
      const reviewsWithEditable = reviewsDto.map(review => ({
        ...review,
        isEditable: currentUserId ? review.userId === currentUserId : false
      }));

      // Sort DTOs: put current user's review first (only if user is authenticated)
      let sortedReviews = reviewsWithEditable;
      if (currentUserId) {
        const currentUserReviewIndex = sortedReviews.findIndex(
          review => review.userId === currentUserId
        );
        
        if (currentUserReviewIndex !== -1) {
          const currentUserReview = sortedReviews.splice(currentUserReviewIndex, 1)[0];
          sortedReviews.unshift(currentUserReview);
          logger.success(currentUserId, 'getProductReviews', `Moved user review to top position`);
        }
      }

      const response: ReviewListResponseDto = {
        reviews: sortedReviews,
        pagination: {
          current: page,
          total: pages,
          limit,
          totalReviews: total
        }
      };

      res.status(200).json({
        success: true,
        code: 'REVIEWS_RETRIEVED',
        message: 'Reviews retrieved successfully',
        data: response
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getProductReviews', `Failed to get product reviews: ${error.message}`);
      res.status(500).json({ 
        success: false,
        code: 'REVIEW_RETRIEVE_ERROR',
        message: 'Failed to retrieve reviews. Please try again.',
        error: error.message 
      });
    }
  };

  // Update a review
  updateReview = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;
      const { rating, comment } = req.body;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({ 
          success: false,
          code: 'UNAUTHORIZED',
          message: 'User not authenticated' 
        });
        return;
      }

      // Check if review exists and belongs to the user
      const review = await this.reviewRepository.findById(idStr);
      if (!review) {
        res.status(404).json({ 
          success: false,
          code: 'REVIEW_NOT_FOUND',
          message: 'Review not found' 
        });
        return;
      }

      // Check if user owns the review or is admin
      let reviewUserId: string;
      if (typeof review.userId === 'object' && review.userId._id) {
        reviewUserId = review.userId._id.toString();
      } else {
        reviewUserId = (review.userId as any).toString();
      }
      
      if (reviewUserId !== userId.toString() && req.user?.role !== UserRole.ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
        res.status(403).json({ 
          success: false,
          code: 'FORBIDDEN',
          message: 'Not authorized to update this review' 
        });
        return;
      }

      const updateData: any = {};
      if (rating !== undefined) updateData.rating = rating;
      if (comment !== undefined) updateData.comment = comment;

      const updatedReview = await this.reviewRepository.update(idStr, updateData);

      logger.success(userId.toString(), 'updateReview', `Updated review ${idStr}`);

      const reviewDto = plainToInstance(ReviewWithDetailsDto, updatedReview!.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'REVIEW_UPDATED',
        message: 'Review updated successfully',
        data: reviewDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'updateReview', `Failed to update review: ${error.message}`);
      res.status(500).json({ 
        success: false,
        code: 'REVIEW_UPDATE_ERROR',
        message: 'Failed to update review. Please try again.',
        error: error.message 
      });
    }
  };

  // Delete a review
  deleteReview = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({ 
          success: false,
          code: 'UNAUTHORIZED',
          message: 'User not authenticated' 
        });
        return;
      }

      // Check if review exists and belongs to the user
      const review = await this.reviewRepository.findById(idStr);
      if (!review) {
        res.status(404).json({ 
          success: false,
          code: 'REVIEW_NOT_FOUND',
          message: 'Review not found' 
        });
        return;
      }

      // Check if user owns the review or is admin
      let reviewUserId: string;
      if (typeof review.userId === 'object' && review.userId._id) {
        reviewUserId = review.userId._id.toString();
      } else {
        reviewUserId = (review.userId as any).toString();
      }
      
      if (reviewUserId !== userId.toString() && req.user?.role !== UserRole.ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
        res.status(403).json({ 
          success: false,
          code: 'FORBIDDEN',
          message: 'Not authorized to delete this review' 
        });
        return;
      }

      const deleted = await this.reviewRepository.delete(idStr);

      if (deleted) {
        logger.success(userId.toString(), 'deleteReview', `Deleted review ${idStr}`);
        res.status(200).json({ 
          success: true,
          code: 'REVIEW_DELETED',
          message: 'Review deleted successfully' 
        });
      } else {
        res.status(400).json({ 
          success: false,
          code: 'DELETE_FAILED',
          message: 'Failed to delete review' 
        });
      }
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'deleteReview', `Failed to delete review: ${error.message}`);
      res.status(500).json({ 
        success: false,
        code: 'REVIEW_DELETE_ERROR',
        message: 'Failed to delete review. Please try again.',
        error: error.message 
      });
    }
  };

  // Mark review as helpful
  markReviewHelpful = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const idStr = Array.isArray(id) ? id[0] : id;

      const review = await this.reviewRepository.incrementHelpfulCount(idStr);

      if (!review) {
        res.status(404).json({ 
          success: false,
          code: 'REVIEW_NOT_FOUND',
          message: 'Review not found' 
        });
        return;
      }

      logger.success('anonymous', 'markReviewHelpful', `Marked review ${id} as helpful`);

      res.status(200).json({
        success: true,
        code: 'REVIEW_MARKED_HELPFUL',
        message: 'Review marked as helpful',
        data: {
          helpfulCount: review.helpfulCount
        }
      });
    } catch (error: any) {
      logger.error('anonymous', 'markReviewHelpful', `Failed to mark review helpful: ${error.message}`);
      res.status(500).json({ 
        success: false,
        code: 'REVIEW_HELPFUL_ERROR',
        message: 'Failed to mark review as helpful. Please try again.',
        error: error.message 
      });
    }
  };

  // Get user's reviews
  getUserReviews = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({ 
          success: false,
          code: 'UNAUTHORIZED',
          message: 'User not authenticated' 
        });
        return;
      }

      const reviews = await this.reviewRepository.findByUserId(userId.toString());

      logger.success(userId.toString(), 'getUserReviews', `Retrieved ${reviews.length} user reviews`);

      const reviewsDto = plainToInstance(ReviewWithDetailsDto, reviews.map(review => review.toObject()), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'USER_REVIEWS_RETRIEVED',
        message: 'User reviews retrieved successfully',
        data: reviewsDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getUserReviews', `Failed to get user reviews: ${error.message}`);
      res.status(500).json({ 
        success: false,
        code: 'USER_REVIEWS_ERROR',
        message: 'Failed to retrieve user reviews. Please try again.',
        error: error.message 
      });
    }
  };
}
