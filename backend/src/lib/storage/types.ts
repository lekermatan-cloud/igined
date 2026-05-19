import type { BucketType } from '../../config';

export interface UploadOptions {
  bucket: BucketType;
  key: string;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface StorageResult {
  url: string;
  key: string;
  size: number;
  etag: string;
  bucket: BucketType;
}

export interface StorageProvider {
  upload(file: ArrayBuffer | ReadableStream, options: UploadOptions): Promise<StorageResult>;
  getSignedUrl(bucket: 'documents' | 'signatures', key: string, expiresIn: number, filename?: string): Promise<string>;
  getPublicUrl(bucket: 'certificates' | 'avatars', key: string): string;
  delete(bucket: BucketType, key: string): Promise<void>;
  copy(
    sourceBucket: BucketType,
    sourceKey: string,
    destBucket: BucketType,
    destKey: string
  ): Promise<void>;
}