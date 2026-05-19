export type BucketType = 'documents' | 'signatures' | 'certificates' | 'avatars';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  JWT_SECRET: string;
  APP_URL: string;
  RESEND_API_KEY: string;
  FROM_EMAIL: string;
  CORS_ORIGINS: string;

  // Storage Configuration
  STORAGE_PROVIDER: 'supabase' | 'r2';
  SUPABASE_STORAGE_URL: string;
  SUPABASE_STORAGE_SERVICE_KEY: string;
  SUPABASE_BUCKET_DOCUMENTS: string;
  SUPABASE_BUCKET_SIGNATURES: string;
  SUPABASE_BUCKET_CERTIFICATES: string;
  SUPABASE_BUCKET_AVATARS: string;

  // Cloudflare R2 (optional)
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET_DOCUMENTS?: string;
  R2_BUCKET_SIGNATURES?: string;
  R2_BUCKET_CERTIFICATES?: string;
  R2_BUCKET_AVATARS?: string;
  R2_PUBLIC_URL?: string;

  // Email Worker Configuration
  FROM_NAME?: string;

  // Signing Engine Configuration
  TSA_URL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_BROWSER_API_TOKEN?: string;

  // Cron Authentication
  CRON_SECRET?: string;

  // Google OAuth
  GOOGLE_CLIENT_ID: string;

  // Stripe Billing
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_BASIC_USD?: string;
  STRIPE_PRICE_PRO_USD?: string;
  STRIPE_PRICE_ENTERPRISE_USD?: string;
  STRIPE_CUSTOMER_PORTAL?: string;
}

export interface AuthContext {
  userId: string;
  email: string;
  isAdmin: boolean;
  teamId?: string;
  isOwner?: boolean;
  scopes?: string[];
  apiKeyId?: string;
}