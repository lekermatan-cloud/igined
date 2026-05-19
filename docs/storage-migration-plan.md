# File Storage Migration Plan: Supabase Storage → Cloudflare R2

## Overview

This document outlines the migration strategy for moving file storage from Supabase Storage to Cloudflare R2. The plan is designed to allow a smooth transition with minimal downtime, starting with Supabase Storage for the MVP and switching to R2 when the application scales.

---

## Current State

- **Database**: `documents` table has `file_url TEXT` column (see `backend/migrations/01-schema.sql`)
- **Backend**: Has Supabase client but no document routes yet
- **Frontend**: Mock upload UI (no real implementation)
- **Storage**: Not yet implemented

---

## Storage Buckets

### Supabase Storage Buckets

| Bucket | Type | Purpose | Access |
|--------|------|---------|--------|
| `documents` | Private | Original uploaded files | Signed URL only |
| `signatures` | Private | Signed/final documents | Signed URL only |
| `certificates` | Public | Generated certificates | Public URL |
| `avatars` | Public | User/team avatars | Public URL |

### Use Cases by Bucket

| Bucket | Uploaded By | When | Example Path |
|--------|-------------|------|---------------|
| `documents` | User | Document upload | `teams/{team_id}/documents/{doc_id}/contract.pdf` |
| `signatures` | System | After all signers sign | `teams/{team_id}/documents/{doc_id}/signed.pdf` |
| `certificates` | System | On document completion | `certificates/{cert_id}/certificate.pdf` |
| `avatars` | User | Profile/team settings | `avatars/users/{user_id}/photo.jpg` |

---

## Architecture

### Storage Abstraction Layer

We will implement a storage abstraction layer that supports multiple providers:

```
src/
├── lib/
│   └── storage/
│       ├── index.ts              # Storage interface (abstraction)
│       ├── supabase-storage.ts   # Supabase implementation
│       └── r2-storage.ts         # Cloudflare R2 implementation
```

### Interface

```typescript
type BucketType = 'documents' | 'signatures' | 'certificates' | 'avatars';

interface StorageProvider {
  upload(file: Buffer | ReadableStream, options: UploadOptions): Promise<StorageResult>;
  getSignedUrl(bucket: 'documents' | 'signatures', key: string, expiresIn: number): Promise<string>;
  getPublicUrl(bucket: 'certificates' | 'avatars', key: string): string;
  delete(bucket: BucketType, key: string): Promise<void>;
  copy(sourceBucket: BucketType, sourceKey: string, destBucket: BucketType, destKey: string): Promise<void>;
}

interface UploadOptions {
  bucket: BucketType;
  key: string;           // e.g., "teams/{team_id}/documents/{doc_id}/filename.pdf"
  contentType: string;   // MIME type
  metadata?: Record<string, string>;
}

interface StorageResult {
  url: string;           // Public or signed URL
  key: string;          // Storage key/path
  size: number;          // File size in bytes
  etag: string;          // ETag for caching
  bucket: BucketType;
}
```

---

## Implementation Phases

### Phase 1: Supabase Storage (MVP - Do First)

**Goal**: Get file uploads working with Supabase Storage

**Steps**:

1. **Add dependencies**:
   ```json
   {
     "@supabase/storage-js": "^2.5.0"
   }
   ```

2. **Add environment variables** (`.env`):
   ```bash
   SUPABASE_STORAGE_URL=https://your-project.supabase.co/storage/v1
   SUPABASE_STORAGE_SERVICE_KEY=your-service-key
   
   # Storage Buckets
   SUPABASE_BUCKET_DOCUMENTS=documents
   SUPABASE_BUCKET_SIGNATURES=signatures
   SUPABASE_BUCKET_CERTIFICATES=certificates
   SUPABASE_BUCKET_AVATARS=avatars
   ```

3. **Create Supabase storage implementation** (`src/lib/storage/supabase-storage.ts`):
   - Implement upload with progress tracking
   - Generate signed URLs for download
   - Handle deletion

4. **Add document API routes** (`src/routes/documents.ts`):
   - `POST /documents` - Upload file, create record
   - `GET /documents` - List documents
   - `GET /documents/:id` - Get document with signed URL
   - `GET /documents/:id/download` - Get download URL
   - `DELETE /documents/:id` - Delete document and file

5. **Add file URL to documents table**:
   - Already has `file_url TEXT` column in schema

---

### Phase 2: Storage Factory & Configuration

**Goal**: Create a factory that instantiates the correct storage provider based on configuration

**Steps**:

1. **Update environment configuration** (`src/config.ts`):
   ```typescript
   export interface Env {
     // ... existing
     STORAGE_PROVIDER: 'supabase' | 'r2';
      
     // Supabase Storage
     SUPABASE_STORAGE_URL?: string;
     SUPABASE_STORAGE_SERVICE_KEY?: string;
     SUPABASE_BUCKET_DOCUMENTS: string;
     SUPABASE_BUCKET_SIGNATURES: string;
     SUPABASE_BUCKET_CERTIFICATES: string;
     SUPABASE_BUCKET_AVATARS: string;
      
     // Cloudflare R2
     R2_ACCOUNT_ID?: string;
     R2_ACCESS_KEY_ID?: string;
     R2_SECRET_ACCESS_KEY?: string;
     R2_BUCKET_DOCUMENTS?: string;
     R2_BUCKET_SIGNATURES?: string;
     R2_BUCKET_CERTIFICATES?: string;
     R2_BUCKET_AVATARS?: string;
     R2_PUBLIC_URL?: string;  // Custom domain for R2
   }
   ```

2. **Create storage factory** (`src/lib/storage/index.ts`):
   ```typescript
   import { createSupabaseStorage } from './supabase-storage';
   import { createR2Storage } from './r2-storage';
   import { Env, StorageProvider } from './types';

   export function createStorage(env: Env): StorageProvider {
     switch (env.STORAGE_PROVIDER) {
       case 'r2':
         return createR2Storage(env);
       case 'supabase':
       default:
         return createSupabaseStorage(env);
     }
   }
   ```

3. **Update wrangler.toml**:
   ```toml
   [vars]
   STORAGE_PROVIDER = "supabase"

   [env.production]
   vars = { STORAGE_PROVIDER = "r2" }
   ```

---

### Phase 3: Cloudflare R2 Implementation

**Goal**: Implement R2 storage provider

**Steps**:

1. **Create 4 R2 buckets** in Cloudflare Dashboard:
   - `sigined-documents` (private) - Original uploaded files
   - `sigined-signatures` (private) - Signed/final documents
   - `sigined-certificates` (public, with CDN) - Generated certificates
   - `sigined-avatars` (public, with CDN) - User/team avatars

2. **Add R2 credentials** to `.dev.vars`:
   ```bash
   R2_ACCOUNT_ID=your_account_id
   R2_ACCESS_KEY_ID=your_access_key
   R2_SECRET_ACCESS_KEY=your_secret_key
   R2_PUBLIC_URL=https://cdn.sigined.com
   
   # R2 Bucket Names
   R2_BUCKET_DOCUMENTS=sigined-documents
   R2_BUCKET_SIGNATURES=sigined-signatures
   R2_BUCKET_CERTIFICATES=sigined-certificates
   R2_BUCKET_AVATARS=sigined-avatars
   ```

3. **R2 storage implementation** (`src/lib/storage/r2-storage.ts`):
   - Uses `@aws-sdk/client-s3` for S3-compatible API
   - Implements all StorageProvider methods
   - ✅ **IMPLEMENTED**

4. **R2 Pricing Notes** (as of 2024):
   - **Storage**: $0.015/GB/month (first 10GB free)
   - **Class A Operations**: $0.005/1,000 requests (PUT, COPY, POST)
   - **Class B Operations**: $0.0004/1,000 requests (GET, SELECT)
   - **Data Transfer**: Free (egress is free to internet)

---

### Phase 4: Data Migration (Future)

**Goal**: Migrate existing files from Supabase to R2

**Steps**:

1. **Create migration script** (`scripts/migrate-to-r2.ts`):
   ```typescript
   import { createSupabaseStorage } from '../lib/storage/supabase-storage';
   import { createR2Storage } from '../lib/storage/r2-storage';

   async function migrate() {
     const source = createSupabaseStorage(env);
     const destination = createR2Storage(env);
     
     // Get all documents with file URLs
     const docs = await supabase
       .from('documents')
       .select('id, file_url')
       .not('file_url', 'is', null);
     
     for (const doc of docs.data) {
       try {
         // Download from source
         const fileData = await source.download(doc.file_url);
         
         // Upload to destination
         const result = await destination.upload(fileData, {
           key: `documents/${doc.id}/file`,
           contentType: 'application/pdf'
         });
         
         // Update database with new URL
         await supabase
           .from('documents')
           .update({ file_url: result.url })
           .eq('id', doc.id);
         
         console.log(`Migrated: ${doc.id}`);
       } catch (error) {
         console.error(`Failed: ${doc.id}`, error);
       }
     }
   }
   ```

2. **Run migration**:
   ```bash
   npx tsx scripts/migrate-to-r2.ts
   ```

3. **Verify**:
   - Spot check migrated files
   - Run integrity checks (SHA-256 hash comparison)
   - Monitor for 404s on old URLs

---

## Configuration Reference

### Development (.dev.vars)

```bash
# Storage Provider
STORAGE_PROVIDER=supabase

# Supabase Storage
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Storage Buckets
SUPABASE_BUCKET_DOCUMENTS=documents
SUPABASE_BUCKET_SIGNATURES=signatures
SUPABASE_BUCKET_CERTIFICATES=certificates
SUPABASE_BUCKET_AVATARS=avatars

# R2 (when enabled)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_key_id
R2_SECRET_ACCESS_KEY=your_secret
R2_PUBLIC_URL=https://cdn.sigined.com
R2_BUCKET_DOCUMENTS=sigined-documents
R2_BUCKET_SIGNATURES=sigined-signatures
R2_BUCKET_CERTIFICATES=sigined-certificates
R2_BUCKET_AVATARS=sigined-avatars
```

### Production (wrangler.toml)

```toml
[vars]
STORAGE_PROVIDER = "r2"
R2_BUCKET_DOCUMENTS = "sigined-documents-prod"
R2_BUCKET_SIGNATURES = "sigined-signatures-prod"
R2_BUCKET_CERTIFICATES = "sigined-certificates-prod"
R2_BUCKET_AVATARS = "sigined-avatars-prod"

[env.production.vars]
STORAGE_PROVIDER = "r2"
R2_BUCKET_DOCUMENTS = "sigined-documents-prod"
R2_BUCKET_SIGNATURES = "sigined-signatures-prod"
R2_BUCKET_CERTIFICATES = "sigined-certificates-prod"
R2_BUCKET_AVATARS = "sigined-avatars-prod"
```

---

## File Organization

### Recommended Path Structure

```
# Supabase Storage
teams/{team_id}/documents/{document_id}/original.pdf
teams/{team_id}/documents/{document_id}/signed.pdf

# R2 (S3-compatible)
sigined-documents-prod/teams/{team_id}/documents/{document_id}/original.pdf
sigined-documents-prod/teams/{team_id}/documents/{document_id}/signed.pdf
```

### Key Components

| Variable | Description |
|----------|-------------|
| `team_id` | UUID of the team |
| `document_id` | UUID of the document |
| `original` | Original uploaded file |
| `signed` | Final signed document |
| `{timestamp}` | Optional version/timestamp |

---

## API Endpoints

### Document Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/documents` | Upload file, create document |
| GET | `/documents` | List documents |
| GET | `/documents/:id` | Get document details |
| GET | `/documents/:id/download` | Get download URL |
| PATCH | `/documents/:id` | Update document metadata |
| DELETE | `/documents/:id` | Delete document and file |

### Request/Response Examples

#### POST /documents

**Request**:
```bash
curl -X POST https://api.sigined.com/documents \
  -H "Authorization: Bearer <token>" \
  -F "file=@contract.pdf" \
  -F "name=My Contract" \
  -F "team_id=uuid"
```

**Response**:
```json
{
  "id": "doc-uuid",
  "name": "My Contract",
  "file_url": "https://...",
  "file_size_bytes": 102400,
  "status": "draft",
  "created_at": "2026-01-15T10:30:00Z"
}
```

---

## Security Considerations

1. **Signed URLs**: Both providers support pre-signed URLs with expiration
2. **Encryption**: Enable R2's built-in encryption at rest
3. **Access Control**: Use R2's token-based authentication for API access
4. **CORS**: Configure CORS policies for web uploads

---

## Testing Checklist

- [ ] Upload file via API
- [ ] Download file via signed URL
- [ ] Delete file (verify removal from storage)
- [ ] Large file upload (>10MB)
- [ ] Unsupported file type rejection
- [ ] Concurrent uploads
- [ ] Storage quota enforcement

---

## Timeline Estimate

| Phase | Task | Effort | Time |
|-------|------|--------|------|
| 1 | Storage interface & Supabase implementation | Medium | 2-3 days |
| 2 | Document API routes | Medium | 2-3 days |
| 3 | Frontend upload integration | Medium | 2-3 days |
| 4 | R2 implementation | Low | 1 day |
| 5 | Migration script | Medium | 1-2 days |

**Total**: ~9-12 days for full implementation

---

## Future Enhancements

1. **Multiple file versions**: Store version history
2. **Thumbnail generation**: Auto-generate thumbnails for images
3. **Virus scanning**: Integrate with Cloudflare Zero Trust or similar
4. **CDN integration**: Use Cloudflare Workers for image optimization
5. **Direct browser uploads**: Use presigned POST policy for direct-to-R2 uploads

---

## Appendix: R2 vs Supabase Storage Comparison

| Feature | Supabase Storage | Cloudflare R2 |
|---------|-----------------|---------------|
| Free Tier | 1GB storage, Unlimited bandwidth | 10GB storage, 1M Class A, 10M Class B |
| Egress | Unlimited (with Pro plan) | Free |
| S3 Compatible | Via wrapper | Native |
| Workers Integration | Limited | Native |
| Custom Domains | Paid | Free |
| Multi-region | Single region | Global |

**Recommendation**: 
- **MVP**: Use Supabase Storage (simpler, same provider as DB)
- **Scale**: Migrate to R2 (better pricing at scale, Cloudflare ecosystem)