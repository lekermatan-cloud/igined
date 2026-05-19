import { StorageClient } from '@supabase/storage-js';
import type { StorageProvider, UploadOptions, StorageResult } from './types';
import type { BucketType } from '../../config';

interface SupabaseEnv {
  SUPABASE_STORAGE_URL: string;
  SUPABASE_STORAGE_SERVICE_KEY: string;
  SUPABASE_BUCKET_DOCUMENTS: string;
  SUPABASE_BUCKET_SIGNATURES: string;
  SUPABASE_BUCKET_CERTIFICATES: string;
  SUPABASE_BUCKET_AVATARS: string;
}

function getBucketName(env: SupabaseEnv, bucket: BucketType): string {
  const bucketMap: Record<BucketType, string> = {
    documents: env.SUPABASE_BUCKET_DOCUMENTS,
    signatures: env.SUPABASE_BUCKET_SIGNATURES,
    certificates: env.SUPABASE_BUCKET_CERTIFICATES,
    avatars: env.SUPABASE_BUCKET_AVATARS,
  };
  return bucketMap[bucket];
}

function isPublicBucket(bucket: BucketType): boolean {
  return bucket === 'certificates' || bucket === 'avatars';
}

export function createSupabaseStorage(env: SupabaseEnv): StorageProvider {
  const client = new StorageClient(env.SUPABASE_STORAGE_URL, {
    apikey: env.SUPABASE_STORAGE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_STORAGE_SERVICE_KEY}`,
  });

  return {
    async upload(
      file: ArrayBuffer | ReadableStream,
      options: UploadOptions
    ): Promise<StorageResult> {
      const bucketName = getBucketName(env, options.bucket);
      const bucket = client.from(bucketName);

      let fileData: Blob | ArrayBuffer;
      if (file instanceof ReadableStream) {
        const chunks: Uint8Array[] = [];
        const reader = file.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const flatArray = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          flatArray.set(chunk, offset);
          offset += chunk.length;
        }
        fileData = flatArray.buffer;
      } else {
        fileData = file;
      }

      const blob = new Blob([fileData], { type: options.contentType });

      const { data, error } = await bucket.upload(options.key, blob, {
        contentType: options.contentType,
        metadata: options.metadata,
        upsert: false,
      });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      const etag = data.path;

      const url = isPublicBucket(options.bucket)
        ? `${env.SUPABASE_STORAGE_URL}/object/public/${bucketName}/${options.key}`
        : `${env.SUPABASE_STORAGE_URL}/object/sign/${bucketName}/${options.key}?token=`;

      return {
        url,
        key: options.key,
        size: blob.size,
        etag,
        bucket: options.bucket,
      };
    },

    async getSignedUrl(
      bucket: 'documents' | 'signatures',
      key: string,
      expiresIn: number,
      filename?: string
    ): Promise<string> {
      const bucketName = getBucketName(env, bucket);
      const bucketObj = client.from(bucketName);

      const { data, error } = await bucketObj.createSignedUrl(key, expiresIn, {
        ...(filename ? { download: filename } : {}),
      });

      if (error) {
        throw new Error(`Failed to create signed URL: ${error.message}`);
      }

      return data.signedUrl;
    },

    getPublicUrl(bucket: 'certificates' | 'avatars', key: string): string {
      const bucketName = getBucketName(env, bucket);
      return `${env.SUPABASE_STORAGE_URL}/object/public/${bucketName}/${key}`;
    },

    async delete(bucket: BucketType, key: string): Promise<void> {
      const bucketName = getBucketName(env, bucket);
      const bucketObj = client.from(bucketName);

      const { error } = await bucketObj.remove([key]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }
    },

    async copy(
      _sourceBucket: BucketType,
      sourceKey: string,
      _destBucket: BucketType,
      destKey: string
    ): Promise<void> {
      const sourceBucketName = getBucketName(env, _sourceBucket);
      const destBucketName = getBucketName(env, _destBucket);
      const sourcePath = `${sourceBucketName}/${sourceKey}`;
      const destPath = `${destBucketName}/${destKey}`;

      const bucket = client.from(sourceBucketName);
      const { error } = await bucket.copy(sourcePath, destPath);

      if (error) {
        throw new Error(`Copy failed: ${error.message}`);
      }
    },
  };
}