import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Storage configuration for multer (memory storage)
const storage = multer.memoryStorage();

// File filter for images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed file types
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.') as any;
    error.code = 'INVALID_FILE_TYPE';
    cb(error);
  }
};

// Multer configuration for single file upload
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1
  }
}).single('image');

// Multer configuration for multiple files upload
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 10 // Maximum 10 files
  }
}).array('images', 10);

// Error handling middleware for multer
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        success: false,
        message: 'File size too large. Maximum size is 5MB per file.'
      });
      return;
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        success: false,
        message: 'Too many files. Maximum allowed is 10 files.'
      });
      return;
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        success: false,
        message: 'Unexpected file field. Use "image" for single upload or "images" for multiple upload.'
      });
      return;
    }
  }
  
  if (error.code === 'INVALID_FILE_TYPE') {
    res.status(400).json({
      success: false,
      message: error.message
    });
    return;
  }

  logger.error('UploadMiddleware', 'handleUploadError', `Upload error: ${error.message}`);
  
  res.status(500).json({
    success: false,
    message: 'File upload failed. Please try again.'
  });
};

// Middleware to validate uploaded files
export const validateUploadedFiles = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.file && !req.files) {
    res.status(400).json({
      success: false,
      message: 'No files uploaded. Please provide at least one image.'
    });
    return;
  }

  // For single file upload
  if (req.file) {
    const file = req.file;
    if (!file.buffer || file.buffer.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Uploaded file is empty.'
      });
      return;
    }
  }

  // For multiple files upload
  if (req.files && Array.isArray(req.files)) {
    const files = req.files;
    if (files.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No files uploaded. Please provide at least one image.'
      });
      return;
    }

    // Check if any file is empty
    const emptyFiles = files.filter(file => !file.buffer || file.buffer.length === 0);
    if (emptyFiles.length > 0) {
      res.status(400).json({
        success: false,
        message: 'One or more uploaded files are empty.'
      });
      return;
    }
  }

  next();
};
