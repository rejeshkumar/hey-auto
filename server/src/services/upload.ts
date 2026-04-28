import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const s3Enabled = !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET);

const s3 = s3Enabled
  ? new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null;

// Local fallback storage (uploads/ dir served statically)
const localUploadDir = path.resolve(process.cwd(), 'uploads');
if (!s3Enabled && !fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir, { recursive: true });
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export async function uploadFileToStorage(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder: string,
): Promise<string> {
  const ext = path.extname(originalName) || '.jpg';
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  if (s3) {
    const uploader = new Upload({
      client: s3,
      params: {
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      },
    });
    await uploader.done();
    logger.info({ key }, 'Uploaded to S3');
    return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
  }

  // Local fallback
  const filePath = path.join(localUploadDir, key.replace(/\//g, '_'));
  fs.writeFileSync(filePath, buffer);
  logger.info({ filePath }, 'Saved locally (no S3 config)');
  // Return a server-relative URL; app.ts will serve /uploads statically
  return `/uploads/${path.basename(filePath)}`;
}
