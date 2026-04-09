import { ReviewModel, Review } from '../models/Review';
import { ProductModel } from '../models/Product';
import mongoose from 'mongoose';

export class ReviewRepository {
  async create(reviewData: Partial<Review>): Promise<Review> {
    const review = new ReviewModel(reviewData);
    const savedReview = await review.save();
    
    // Update product rating and review count
    await this.updateProductRating(reviewData.productId!);
    
    return savedReview;
  }

  async findById(id: string): Promise<Review | null> {
    return ReviewModel.findById(id).populate('userId', 'username email').populate('productId', 'title');
  }

  async findByProductId(
    productId: string, 
    page: number = 1, 
    limit: number = 10,
    sort: string = 'newest'
  ): Promise<{ reviews: Review[]; total: number; pages: number }> {
    const skip = (page - 1) * limit;
    
    let sortOptions: any = { createdAt: -1 };
    
    switch (sort) {
      case 'oldest':
        sortOptions = { createdAt: 1 };
        break;
      case 'highest':
        sortOptions = { rating: -1 };
        break;
      case 'lowest':
        sortOptions = { rating: 1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const reviews = await ReviewModel.find({ productId })
      .populate('userId', 'username email')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit);

    const total = await ReviewModel.countDocuments({ productId });
    const pages = Math.ceil(total / limit);

    return { reviews, total, pages };
  }

  async findByUserId(userId: string): Promise<Review[]> {
    return ReviewModel.find({ userId }).populate('productId', 'title').sort({ createdAt: -1 });
  }

  async update(id: string, updateData: Partial<Review>): Promise<Review | null> {
    const review = await ReviewModel.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    ).populate('userId', 'username email').populate('productId', 'title');

    if (review) {
      // Update product rating when review is updated
      await this.updateProductRating(review.productId);
    }

    return review;
  }

  async delete(id: string): Promise<boolean> {
    const review = await ReviewModel.findById(id);
    if (!review) return false;

    await ReviewModel.findByIdAndDelete(id);
    
    // Update product rating when review is deleted
    await this.updateProductRating(review.productId);
    
    return true;
  }

  async incrementHelpfulCount(id: string): Promise<Review | null> {
    return ReviewModel.findByIdAndUpdate(
      id, 
      { $inc: { helpfulCount: 1 } }, 
      { new: true }
    ).populate('userId', 'username email').populate('productId', 'title');
  }

  async checkUserReview(productId: string, userId: string): Promise<Review | null> {
    return ReviewModel.findOne({ productId, userId });
  }

  async getReviewStats(productId: string): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  }> {
    const stats = await ReviewModel.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    const result = stats[0] || { averageRating: 0, totalReviews: 0, ratingDistribution: [] };
    
    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    result.ratingDistribution.forEach((rating: number) => {
      distribution[rating as keyof typeof distribution]++;
    });

    return {
      averageRating: Math.round(result.averageRating * 100) / 100,
      totalReviews: result.totalReviews,
      ratingDistribution: distribution
    };
  }

  private async updateProductRating(productId: mongoose.Types.ObjectId): Promise<void> {
    const stats = await ReviewModel.aggregate([
      { $match: { productId } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    const { averageRating = 0, totalReviews = 0 } = stats[0] || {};

    await ProductModel.findByIdAndUpdate(productId, {
      rating: Math.round(averageRating * 100) / 100,
      reviewCount: totalReviews
    });
  }
}
