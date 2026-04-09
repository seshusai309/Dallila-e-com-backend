export const AWS_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  s3Bucket: process.env.AWS_S3_BUCKET || 'ecommerce-application-kajkarma',
  s3FolderPrefix: process.env.AWS_S3_FOLDER_PREFIX || 'ecommerce-images'
};

export const S3_FOLDERS = {
  PRODUCTS: `${AWS_CONFIG.s3FolderPrefix}/products`,
  USERS: `${AWS_CONFIG.s3FolderPrefix}/users`
};
