# Sigil · Database Schema (Supabase / Postgres)

This is the proposed schema. The developer can refine it during Phase 1, but every table here is required.

## Core principle: Row-Level Security on EVERYTHING

Every table has RLS enabled. The default policy is "deny all". Then we add explicit policies per role.

---

## Tables

### `users`
Extends Supabase's built-in `auth.users`.

```sql
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  company text,
  phone text,
  preferred_language text default 'he' check (preferred_language in ('he', 'en')),
  country_code text,
  created_at timestamptz default now(),

  -- Subscription
  plan text default 'free' check (plan in ('free', 'basic', 'pro', 'enterprise')),
  plan_currency text default 'USD' check (plan_currency in ('USD', 'ILS')),
  trial_ends_at timestamptz,
  stripe_customer_id text,
  tranzila_customer_id text,
  subscription_status text default 'active', -- active | past_due | cancelled | trialing

  -- Onboarding
  onboarding_completed boolean default false,
  onboarding_steps jsonb default '{}',

  -- Referral
  referral_code text unique not null default substring(md5(random()::text), 1, 8),
  referred_by uuid references users(id),

  -- Admin
  is_admin boolean default false,
  is_suspended boolean default false,
  notes text -- internal admin notes
);

create index users_email_idx on users(email);
create index users_plan_idx on users(plan);
create index users_referral_code_idx on users(referral_code);
```

### `documents`
Every uploaded file.

```sql
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  storage_path text not null, -- Supabase Storage key
  size_bytes bigint not null,
  mime_type text not null,
  kind text not null check (kind in ('pdf', 'image', 'video', 'audio', 'doc')),
  sha256 text not null, -- 64-char hex

  status text default 'draft' check (status in ('draft', 'awaiting', 'signed', 'certified', 'expired', 'cancelled')),
  signing_order text default 'parallel' check (signing_order in ('parallel', 'sequential')),

  fields jsonb default '[]', -- Array of signature field definitions
  template_id uuid references templates(id), -- if created from template

  created_at timestamptz default now(),
  signed_at timestamptz,
  certified_at timestamptz,
  expires_at timestamptz,

  unique(owner_id, sha256) -- prevent duplicate uploads
);

create index documents_owner_id_idx on documents(owner_id);
create index documents_status_idx on documents(status);
create index documents_sha256_idx on documents(sha256);
```

### `signers`
Every person who needs to sign a document.

```sql
create table public.signers (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  email text not null,
  name text,
  role text, -- "Primary signer", "Witness", etc.
  color text default '#c8924a',
  signing_order int default 1,
  status text default 'pending' check (status in ('pending', 'viewed', 'signed', 'declined')),

  -- Auth
  signing_token text unique not null default encode(gen_random_bytes(32), 'hex'),

  -- Signature data
  signature_data text, -- base64 PNG of the actual signature
  signed_at timestamptz,
  ip_address inet,
  user_agent text,

  created_at timestamptz default now()
);

create index signers_document_id_idx on signers(document_id);
create index signers_signing_token_idx on signers(signing_token);
```

### `certificates`
Ownership certificates issued after document is fully signed.

```sql
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  block_hash text unique not null, -- SHA-256 of (doc_hash + signatures + timestamp)
  issued_at timestamptz default now(),

  -- Public verification
  public_id text unique not null default substring(md5(random()::text), 1, 16),

  -- Certificate metadata
  owner_name text not null,
  signer_count int not null,
  metadata jsonb default '{}'
);

create index certificates_block_hash_idx on certificates(block_hash);
create index certificates_public_id_idx on certificates(public_id);
```

### `templates`
Pre-made document templates (NDA, freelance contract, etc.).

```sql
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete cascade, -- null = system template
  name jsonb not null, -- {he: "...", en: "..."}
  category text check (category in ('legal', 'business', 'real-estate', 'hr', 'sales', 'creative')),
  storage_path text not null,
  preview_path text,
  fields jsonb default '[]',
  is_public boolean default false,
  uses_count int default 0,
  created_at timestamptz default now()
);
```

### `teams` and `team_members`
For Pro plan: multi-user accounts.

```sql
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references users(id),
  plan text default 'pro',
  seats int default 5,
  created_at timestamptz default now()
);

create table public.team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  invited_at timestamptz default now(),
  joined_at timestamptz,
  primary key (team_id, user_id)
);
```

### `referrals`
Tracking the referral program.

```sql
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references users(id) on delete cascade,
  referred_user_id uuid references users(id) on delete set null,
  referred_email text not null,

  status text default 'invited' check (status in ('invited', 'signed_up', 'converted', 'rewarded')),
  reward_credit_usd numeric(10, 2),

  invited_at timestamptz default now(),
  signed_up_at timestamptz,
  converted_at timestamptz, -- when they paid first time
  rewarded_at timestamptz
);

create index referrals_referrer_id_idx on referrals(referrer_id);
```

### `api_keys` and `webhooks`
For Pro plan: programmatic access.

```sql
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  name text not null,
  prefix text not null, -- "sk_live_" or "sk_test_"
  hashed_key text not null, -- bcrypt of the key
  last_used_at timestamptz,
  scopes text[] default array['read'],
  created_at timestamptz default now(),
  revoked_at timestamptz
);

create table public.webhooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  url text not null,
  events text[] not null, -- ['document.signed', 'document.certified', etc.]
  secret text not null, -- HMAC signing secret
  active boolean default true,
  created_at timestamptz default now()
);
```

### `email_queue` and `email_log`
The automation engine.

```sql
create table public.email_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  signer_id uuid references signers(id) on delete cascade,
  template text not null, -- 'welcome_d0', 'abandoned_upload_h1', etc.
  scheduled_for timestamptz not null,
  status text default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),

  -- Idempotency: prevent same template from being queued twice for same user
  idempotency_key text unique,

  payload jsonb default '{}',
  created_at timestamptz default now(),
  sent_at timestamptz,
  error text
);

create index email_queue_pending_idx on email_queue(scheduled_for) where status = 'pending';

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  template text not null,
  resend_email_id text, -- Resend's message ID
  to_email text not null,
  subject text,
  sent_at timestamptz default now(),

  -- Engagement
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz
);

create index email_log_user_id_idx on email_log(user_id);
create index email_log_template_idx on email_log(template);
```

### `audit_log`
Tamper-proof record of important events. Useful in court.

```sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  document_id uuid references documents(id) on delete set null,
  action text not null, -- 'document.uploaded', 'signature.added', 'certificate.issued', etc.
  ip_address inet,
  user_agent text,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create index audit_log_user_id_idx on audit_log(user_id);
create index audit_log_document_id_idx on audit_log(document_id);
create index audit_log_action_idx on audit_log(action);

-- Make this append-only
create or replace function prevent_audit_log_modification()
returns trigger as $$
begin
  raise exception 'audit_log is append-only';
end;
$$ language plpgsql;

create trigger no_update_audit_log
before update or delete on audit_log
for each row execute function prevent_audit_log_modification();
```

---

## RLS Policies (examples)

```sql
-- Users see only their own row
alter table users enable row level security;
create policy "users_select_own" on users for select using (auth.uid() = id);
create policy "users_update_own" on users for update using (auth.uid() = id);

-- Documents: owner sees all, signers see ones they're invited to
alter table documents enable row level security;
create policy "documents_owner_all" on documents for all using (auth.uid() = owner_id);
create policy "documents_signer_read" on documents for select using (
  exists (
    select 1 from signers
    where signers.document_id = documents.id
      and signers.email = auth.jwt()->>'email'
  )
);

-- Admin: full access (when is_admin = true)
create policy "admin_all_users" on users for all using (
  exists (select 1 from users u where u.id = auth.uid() and u.is_admin = true)
);
```

---

## Cron Jobs (`pg_cron` extension)

```sql
-- Daily: process the email queue (every 5 minutes)
select cron.schedule(
  'process-email-queue',
  '*/5 * * * *',
  $$ select process_email_queue(); $$
);

-- Daily: detect abandoned uploads (1 hour after upload)
select cron.schedule(
  'detect-abandoned-uploads',
  '*/15 * * * *',
  $$
    insert into email_queue (user_id, template, scheduled_for, idempotency_key)
    select
      d.owner_id,
      'abandoned_upload_h1',
      now(),
      'abandoned_upload_h1_' || d.id
    from documents d
    where d.status = 'draft'
      and d.created_at < now() - interval '1 hour'
      and d.created_at > now() - interval '2 hours'
    on conflict (idempotency_key) do nothing;
  $$
);

-- Daily: trial-ending warnings
select cron.schedule(
  'trial-ending-warnings',
  '0 9 * * *',
  $$
    insert into email_queue (user_id, template, scheduled_for, idempotency_key)
    select
      id,
      case
        when trial_ends_at::date = current_date + 7 then 'trial_ending_d7'
        when trial_ends_at::date = current_date + 3 then 'trial_ending_d3'
        when trial_ends_at::date = current_date + 1 then 'trial_ending_d1'
      end,
      now(),
      'trial_ending_' || id || '_' || trial_ends_at::date
    from users
    where plan = 'trial'
      and trial_ends_at::date in (current_date + 7, current_date + 3, current_date + 1)
    on conflict (idempotency_key) do nothing;
  $$
);
```

---

## Storage buckets

```sql
-- Public bucket for verification page (limited access)
insert into storage.buckets (id, name, public) values ('public-certs', 'public-certs', true);

-- Private bucket for documents
insert into storage.buckets (id, name, public) values ('documents', 'documents', false);

-- RLS on documents bucket: only owner and invited signers can access
create policy "documents_owner_read" on storage.objects for select
using (
  bucket_id = 'documents' and
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Performance notes

- Use `materialized view` for the admin dashboard MRR calculation, refresh hourly
- Cache the certificate verification page on Cloudflare for 1 year (it's immutable)
- Background job to compute monthly cohort retention (don't query on demand)
- Add `pg_stat_statements` extension for query monitoring

That's it. Build it well.
