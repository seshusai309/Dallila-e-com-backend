import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AWS_CONFIG, S3_FOLDERS } from '../constants/aws';
import { logger } from '../utils/logger';

export class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: AWS_CONFIG.region,
      credentials: {
        accessKeyId: AWS_CONFIG.accessKeyId,
        secretAccessKey: AWS_CONFIG.secretAccessKey,
      },
    });
  }

  /**
   * Upload product images to S3
   */
  async uploadProductImages(
    productId: string,
    files: Array<{ buffer: Buffer; originalName: string; mimeType: string }>
  ): Promise<Array<{ url: string; key: string }>> {
    try {
      const uploadPromises = files.map(async (file, index) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const extension = file.originalName.split('.').pop() || 'jpg';
        const filename = `product_${productId}_${index + 1}_${timestamp}.${extension}`;
        
        // S3 key for product image
        const key = `${S3_FOLDERS.PRODUCTS}/${productId}/${filename}`;

        // Upload to S3
        const command = new PutObjectCommand({
          Bucket: AWS_CONFIG.s3Bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimeType,
          Metadata: {
            productId,
            originalName: file.originalName,
            uploadedAt: new Date().toISOString(),
          },
        });

        await this.s3Client.send(command);

        // Generate public URL
        const url = `https://${AWS_CONFIG.s3Bucket}.s3.${AWS_CONFIG.region}.amazonaws.com/${key}`;

        logger.success('S3Service', 'uploadProductImages', `Product image uploaded successfully: ${key}`);

        return { url, key };
      });

      const results = await Promise.all(uploadPromises);
      
      logger.success('S3Service', 'uploadProductImages', `Uploaded ${results.length} product images for product: ${productId}`);
      
      return results;
    } catch (error: any) {
      logger.error('S3Service', 'uploadProductImages', `Failed to upload product images: ${error.message}`);
      throw new Error(`Failed to upload product images to S3: ${error.message}`);
    }
  }

  /**
   * Upload single product image to S3
   */
  async uploadProductImage(
    productId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string }
  ): Promise<{ url: string; key: string }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = file.originalName.split('.').pop() || 'jpg';
      const filename = `product_${productId}_${timestamp}.${extension}`;
      
      // S3 key for product image
      const key = `${S3_FOLDERS.PRODUCTS}/${productId}/${filename}`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: AWS_CONFIG.s3Bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
        Metadata: {
          productId,
          originalName: file.originalName,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      // Generate public URL
      const url = `https://${AWS_CONFIG.s3Bucket}.s3.${AWS_CONFIG.region}.amazonaws.com/${key}`;

      logger.success('S3Service', 'uploadProductImage', `Product image uploaded successfully: ${key}`);

      return { url, key };
    } catch (error: any) {
      logger.error('S3Service', 'uploadProductImage', `Failed to upload product image: ${error.message}`);
      throw new Error(`Failed to upload product image to S3: ${error.message}`);
    }
  }

  /**
   * Upload user profile image to S3
   */
  async uploadUserProfileImage(
    userId: string,
    file: { buffer: Buffer; originalName: string; mimeType: string }
  ): Promise<{ url: string; key: string }> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = file.originalName.split('.').pop() || 'jpg';
      const filename = `user_${userId}_profile_${timestamp}.${extension}`;
      
      // S3 key for user profile image
      const key = `${S3_FOLDERS.USERS}/${userId}/profile/${filename}`;

      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: AWS_CONFIG.s3Bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
        Metadata: {
          userId,
          originalName: file.originalName,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      // Generate public URL
      const url = `https://${AWS_CONFIG.s3Bucket}.s3.${AWS_CONFIG.region}.amazonaws.com/${key}`;

      logger.success('S3Service', 'uploadUserProfileImage', `User profile image uploaded successfully: ${key}`);

      return { url, key };
    } catch (error: any) {
      logger.error('S3Service', 'uploadUserProfileImage', `Failed to upload user profile image: ${error.message}`);
      throw new Error(`Failed to upload user profile image to S3: ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: AWS_CONFIG.s3Bucket,
        Key: key,
      });

      await this.s3Client.send(command);
      
      logger.success('S3Service', 'deleteFile', `File deleted successfully: ${key}`);
    } catch (error: any) {
      logger.error('S3Service', 'deleteFile', `Failed to delete file: ${error.message}`);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Generate presigned URL for downloading files
   */
  async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: AWS_CONFIG.s3Bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      
      logger.success('S3Service', 'getDownloadUrl', `Download URL generated for: ${key}`);
      
      return url;
    } catch (error: any) {
      logger.error('S3Service', 'getDownloadUrl', `Failed to generate download URL: ${error.message}`);
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Generate S3 key for product image
   */
  generateProductImageKey(productId: string, filename: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = filename.split('.').pop() || 'jpg';
    return `${S3_FOLDERS.PRODUCTS}/${productId}/product_${productId}_${timestamp}.${extension}`;
  }

  /**
   * Generate S3 key for user profile image
   */
  generateUserProfileKey(userId: string, filename: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = filename.split('.').pop() || 'jpg';
    return `${S3_FOLDERS.USERS}/${userId}/profile/user_${userId}_profile_${timestamp}.${extension}`;
  }
}
