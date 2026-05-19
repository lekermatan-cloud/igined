import { createSupabaseStorage } from './supabase-storage';
import { createR2Storage } from './r2-storage';
import type { StorageProvider } from './types';
import type { Env } from '../../config';

export type { StorageProvider, UploadOptions, StorageResult } from './types';
export { createSupabaseStorage } from './supabase-storage';
export { createR2Storage } from './r2-storage';

export function createStorage(env: Env): StorageProvider {
  switch (env.STORAGE_PROVIDER) {
    case 'r2':
      if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
        throw new Error('R2 storage is configured but missing credentials. Ensure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are set.');
      }
      return createR2Storage({
        R2_ACCOUNT_ID: env.R2_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET_DOCUMENTS: env.R2_BUCKET_DOCUMENTS || 'sigined-documents',
        R2_BUCKET_SIGNATURES: env.R2_BUCKET_SIGNATURES || 'sigined-signatures',
        R2_BUCKET_CERTIFICATES: env.R2_BUCKET_CERTIFICATES || 'sigined-certificates',
        R2_BUCKET_AVATARS: env.R2_BUCKET_AVATARS || 'sigined-avatars',
        R2_PUBLIC_URL: env.R2_PUBLIC_URL,
      });
    case 'supabase':
    default:
      return createSupabaseStorage({
        SUPABASE_STORAGE_URL: env.SUPABASE_STORAGE_URL,
        SUPABASE_STORAGE_SERVICE_KEY: env.SUPABASE_STORAGE_SERVICE_KEY,
        SUPABASE_BUCKET_DOCUMENTS: env.SUPABASE_BUCKET_DOCUMENTS,
        SUPABASE_BUCKET_SIGNATURES: env.SUPABASE_BUCKET_SIGNATURES,
        SUPABASE_BUCKET_CERTIFICATES: env.SUPABASE_BUCKET_CERTIFICATES,
        SUPABASE_BUCKET_AVATARS: env.SUPABASE_BUCKET_AVATARS,
      });
  }
}