import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Storage, Bucket } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import * as path from 'path';
import sharp from 'sharp';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// extension -> accepted MIME types. Anything else (incl. executables) is rejected.
const ALLOWED: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
  '.txt': ['text/plain'],
};

// leading bytes per extension, to catch renamed executables / mislabeled files
const MAGIC: Record<string, number[]> = {
  '.pdf': [0x25, 0x50, 0x44, 0x46],
  '.png': [0x89, 0x50, 0x4e, 0x47],
  '.jpg': [0xff, 0xd8, 0xff],
  '.jpeg': [0xff, 0xd8, 0xff],
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: Bucket | null;

  constructor() {
    const name = process.env.GCS_BUCKET;
    if (!name) {
      this.bucket = null;
      this.logger.warn('GCS_BUCKET not set — file uploads are disabled.');
      return;
    }
    const raw = process.env.GCS_CREDENTIALS_JSON;
    const storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      ...(raw ? { credentials: JSON.parse(raw) } : {}), // else falls back to ADC (gcloud login)
    });
    this.bucket = storage.bucket(name);
  }

  get enabled(): boolean {
    return !!this.bucket;
  }

  /** Validates, optimises images, uploads, and returns the stored object key. */
  async upload(file: Express.Multer.File, prefix: string) {
    if (!this.bucket) throw new ServiceUnavailableException('File storage is not configured');
    const ext = path.extname(file.originalname).toLowerCase();
    const mimes = ALLOWED[ext];
    if (!mimes || !mimes.includes(file.mimetype)) {
      throw new BadRequestException('Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, TXT');
    }
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('File exceeds 20 MB limit');
    const magic = MAGIC[ext];
    if (magic && !magic.every((b, i) => file.buffer[i] === b)) {
      throw new BadRequestException('File content does not match its extension');
    }

    let body = file.buffer;
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      body = await sharp(file.buffer).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).toBuffer();
    }

    const key = `${prefix}/${randomUUID()}${ext}`;
    await this.bucket.file(key).save(body, { contentType: file.mimetype, resumable: false });
    return { key, size: body.length, contentType: file.mimetype };
  }

  /** Short-lived read URL; objects are private (public access prevention is on). */
  async signedUrl(key: string, minutes = 10): Promise<string> {
    if (!this.bucket) throw new ServiceUnavailableException('File storage is not configured');
    const [url] = await this.bucket.file(key).getSignedUrl({ action: 'read', expires: Date.now() + minutes * 60_000 });
    return url;
  }
}
