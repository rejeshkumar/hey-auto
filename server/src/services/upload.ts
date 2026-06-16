import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { logger } from '../utils/logger';

// Cloudflare R2 uses the AWS S3 SDK — only the endpoint changes.
// R2 env vars take priority; falls back to legacy AWS vars for compatibility.
const r2Enabled = !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME);
const awsEnabled = !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET);
const storageEnabled = r2Enabled || awsEnabled;

function buildStorageClient(): S3Client | null {
  if (r2Enabled) {
    return new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  if (awsEnabled) {
    return new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return null;
}

const storageClient = buildStorageClient();

function getBucketName(): string {
  return r2Enabled ? env.R2_BUCKET_NAME! : env.AWS_S3_BUCKET;
}

function buildPublicUrl(key: string): string {
  if (r2Enabled) {
    // Use custom public domain if configured, otherwise R2 dev URL
    const base = env.R2_PUBLIC_URL
      ? env.R2_PUBLIC_URL.replace(/\/$/, '')
      : `https://pub-${env.R2_ACCOUNT_ID}.r2.dev`;
    return `${base}/${key}`;
  }
  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}

// Local fallback — only used when neither R2 nor AWS is configured
const localUploadDir = path.resolve(process.cwd(), 'uploads');
if (!storageEnabled && !fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir, { recursive: true });
}

if (!storageEnabled) {
  logger.warn('No cloud storage configured (R2 or S3). Files will be saved locally and LOST on redeploy. Set R2_* env vars to fix this.');
}

// Magic-byte signatures for allowed file types — client-provided MIME type is not trusted
const MAGIC_BYTES: { magic: Buffer; mime: string }[] = [
  { magic: Buffer.from([0xff, 0xd8, 0xff]),             mime: 'image/jpeg' },
  { magic: Buffer.from([0x89, 0x50, 0x4e, 0x47]),       mime: 'image/png'  },
  { magic: Buffer.from([0x52, 0x49, 0x46, 0x46]),       mime: 'image/webp' }, // RIFF....WEBP
  { magic: Buffer.from([0x25, 0x50, 0x44, 0x46]),       mime: 'application/pdf' }, // %PDF
];

function detectMimeFromBuffer(buf: Buffer): string | null {
  for (const { magic, mime } of MAGIC_BYTES) {
    if (buf.slice(0, magic.length).equals(magic)) return mime;
  }
  // HEIC: ftyp box at byte 4 containing 'heic' or 'heix'
  if (buf.length >= 12) {
    const ftyp = buf.slice(4, 8).toString('ascii');
    const brand = buf.slice(8, 12).toString('ascii');
    if (ftyp === 'ftyp' && (brand.startsWith('heic') || brand.startsWith('heix') || brand.startsWith('mif1'))) {
      return 'image/heic';
    }
  }
  return null;
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter(_req, file, cb) {
    // First pass: reject obviously wrong MIME types before buffering the full file
    const declaredAllowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
    if (!declaredAllowed.includes(file.mimetype)) {
      return cb(new Error('Only images (JPEG, PNG, WebP, HEIC) and PDF files are allowed'));
    }
    cb(null, true);
  },
});

export async function uploadFileToStorage(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  folder: string,
): Promise<string> {
  // Validate actual file content against magic bytes — rejects MIME-spoofed uploads
  const detectedMime = detectMimeFromBuffer(buffer);
  if (!detectedMime) {
    throw new Error('File content does not match any allowed type (JPEG, PNG, WebP, HEIC, PDF)');
  }

  // Derive a safe extension from the detected type — never trust the original filename extension
  const safeExtMap: Record<string, string> = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
    'image/heic': '.heic', 'application/pdf': '.pdf',
  };
  const ext = safeExtMap[detectedMime] ?? '.bin';
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  if (storageClient) {
    const uploader = new Upload({
      client: storageClient,
      params: {
        Bucket: getBucketName(),
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      },
    });
    await uploader.done();
    const url = buildPublicUrl(key);
    logger.info({ key, provider: r2Enabled ? 'R2' : 'S3' }, 'File uploaded to cloud storage');
    return url;
  }

  // Local fallback — not suitable for production
  const filePath = path.join(localUploadDir, key.replace(/\//g, '_'));
  fs.writeFileSync(filePath, buffer);
  logger.warn({ filePath }, 'File saved locally — will be lost on redeploy');
  return `/uploads/${path.basename(filePath)}`;
}
