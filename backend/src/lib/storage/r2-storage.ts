import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider, UploadOptions, StorageResult } from "./types";
import type { BucketType } from "../../config";

interface R2Env {
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_DOCUMENTS: string;
  R2_BUCKET_SIGNATURES: string;
  R2_BUCKET_CERTIFICATES: string;
  R2_BUCKET_AVATARS: string;
  R2_PUBLIC_URL?: string;
}

function getBucketName(env: R2Env, bucket: BucketType): string {
  const bucketMap: Record<BucketType, string> = {
    documents: env.R2_BUCKET_DOCUMENTS,
    signatures: env.R2_BUCKET_SIGNATURES,
    certificates: env.R2_BUCKET_CERTIFICATES,
    avatars: env.R2_BUCKET_AVATARS,
  };
  return bucketMap[bucket];
}

function isPublicBucket(bucket: BucketType): boolean {
  return bucket === "certificates" || bucket === "avatars";
}

export function createR2Storage(env: R2Env): StorageProvider {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  return {
    async upload(
      file: ArrayBuffer | ReadableStream,
      options: UploadOptions
    ): Promise<StorageResult> {
      const bucketName = getBucketName(env, options.bucket);

      let fileData: ArrayBuffer;
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

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: options.key,
        Body: fileData,
        ContentType: options.contentType,
        Metadata: options.metadata,
      });

      const response = await client.send(command);

      const etag = response.ETag || "";

      const url = isPublicBucket(options.bucket)
        ? `${env.R2_PUBLIC_URL || `https://${bucketName}.r2.dev`}/${options.key}`
        : `${env.R2_PUBLIC_URL || `https://${bucketName}.r2.dev`}/${options.key}`;

      return {
        url,
        key: options.key,
        size: fileData.byteLength,
        etag,
        bucket: options.bucket,
      };
    },

    async getSignedUrl(
      bucket: "documents" | "signatures",
      key: string,
      expiresIn: number,
      filename?: string
    ): Promise<string> {
      const bucketName = getBucketName(env, bucket);

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
      });

      const signedUrl = await getSignedUrl(client, command, { expiresIn });
      return signedUrl;
    },

    getPublicUrl(bucket: "certificates" | "avatars", key: string): string {
      const bucketName = getBucketName(env, bucket);
      return `${env.R2_PUBLIC_URL || `https://${bucketName}.r2.dev`}/${key}`;
    },

    async delete(bucket: BucketType, key: string): Promise<void> {
      const bucketName = getBucketName(env, bucket);

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      });

      await client.send(command);
    },

    async copy(
      sourceBucket: BucketType,
      sourceKey: string,
      destBucket: BucketType,
      destKey: string
    ): Promise<void> {
      const sourceBucketName = getBucketName(env, sourceBucket);
      const destBucketName = getBucketName(env, destBucket);

      const command = new CopyObjectCommand({
        Bucket: destBucketName,
        CopySource: `${sourceBucketName}/${sourceKey}`,
        Key: destKey,
      });

      await client.send(command);
    },
  };
}