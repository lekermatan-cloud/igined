# Sigined — Feature Status Report

**Version:** 1.0-draft  
**Date:** May 15, 2026  
**Prepared for:** Client Review

---

## Overview

Sigined is a bilingual (Hebrew/English) digital signature SaaS platform. This document summarizes the current implementation status of all major features — what is working, what is in progress, and what remains to be done.

---

## ✅ Live / Working Features

### Authentication & Users
| Feature | Status | Notes |
|---------|--------|-------|
| Email + Password Registration | ✅ | With terms/privacy acceptance |
| Email + Password Login | ✅ | JWT-based sessions |
| Password Reset | ✅ | Via email token |
| Personal Team auto-creation | ✅ | Created automatically on registration |
| Referral system | ✅ | `/ref/{code}` URL, both parties rewarded on first signature |
| User profile (name, phone, avatar) | ✅ | Editable in settings |
| Onboarding tracking | ✅ | Tracks: upload, sign, invite, API key, branding per user |

### Documents
| Feature | Status | Notes |
|---------|--------|-------|
| Document upload | ✅ | PDF, drag-and-drop, multipart upload |
| Document storage (Supabase / R2) | ✅ | Configurable provider |
| Document list with filters | ✅ | Status filters, search |
| Send for signing | ✅ | Create signers, send invite emails |
| Per-signer status tracking | ✅ | pending / signed / declined |
| SHA-256 hash fingerprinting | ✅ | Calculated on upload |
| Document download | ✅ | Original file retrieval |
| Document detail modal | ✅ | Preview, send, signer management |

### Signing
| Feature | Status | Notes |
|---------|--------|-------|
| Signing page (per signer token) | ✅ | Token-based access, no login required |
| Drawn signature (canvas) | ✅ | Touch/mouse drawing |
| Typed signature | ✅ | Styled text option |
| Consent text capture | ✅ | Required before signing |
| Forensic data capture | ✅ | IP, user agent, geolocation |
| Certificate of completion | ✅ | Generated on all signatories signing |

### Teams
| Feature | Status | Notes |
|---------|--------|-------|
| Personal team per user | ✅ | Auto-created on registration |
| Team member management | ✅ | Invite by email, role assignment |
| Team owner controls | ✅ | Owner can remove/manage members |

### Document Templates
| Feature | Status | Notes |
|---------|--------|-------|
| Templates UI page | ⚠️ **Mock data** | Displays static placeholder templates; not connected to any API or database |

### Dashboard
| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard overview | ✅ | Dynamic stats from API |
| Recent documents | ✅ | Latest 5 with status |
| Onboarding checklist | ✅ | Visual progress tracker |
| Referral stats | ✅ | Invites, conversions, rewards |

### API & Developer
| Feature | Status | Notes |
|---------|--------|-------|
| API keys | ✅ | Create, list, revoke. Prefix: `sk_live_`, 32 chars, SHA-256 hashed |
| API key authentication | ✅ | Works alongside JWT auth in middleware |

### Billing (Infrastructure Ready)
| Feature | Status | Notes |
|---------|--------|-------|
| Checkout session creation | ✅ | Stripe Checkout, 14-day trial |
| Customer Portal link | ✅ | Opens Stripe self-service portal |
| Subscription status endpoint | ✅ | Plan, status, period dates |
| Invoice history endpoint | ✅ | Paginated, with PDF URLs |
| Stripe webhook handler | ✅ | Handles: checkout, subscription, invoice events |
| Billing page (frontend) | ✅ | Shows real plan, usage, invoices from API |

---

## 🔧 In Progress / Pending Configuration

### Stripe Billing
| Item | Status |
|------|--------|
| Stripe account | 🔧 **Requires configuration** |
| Product/Price creation in Stripe Dashboard | 🔧 **Pending** |
| `STRIPE_SECRET_KEY` | 🔧 **Requires real key in `.dev.vars`** |
| `STRIPE_WEBHOOK_SECRET` | 🔧 **Requires webhook endpoint setup** |
| Price IDs (`STRIPE_PRICE_*`) | 🔧 **Pending Stripe Price IDs** |
| Customer Portal enabled | 🔧 **Requires enabling in Stripe Dashboard** |
| Live URL in `wrangler.toml` | 🔧 **Pending production deploy** |

**Action required:** Create products in Stripe Dashboard (Basic $8/mo, Pro $100/mo, Enterprise $450/mo), copy Price IDs into environment variables.

### Tranzila Billing (ILS / Israeli market)
| Item | Status |
|------|--------|
| Tranzila account | ⏳ **Deferred — not yet implemented** |
| ILS pricing (₪30 Basic, ₪370 Pro) | ⏳ **Deferred** |
| 17% Israeli VAT calculation | ⏳ **Deferred** |
| חשבונית מס (legal invoice) generation | ⏳ **Deferred** |

---

## 📋 Planned / Not Yet Implemented

### Google OAuth
| Feature | Status |
|---------|--------|
| Google OAuth login | 📋 **Not yet implemented** |
| Google account linking | 📋 **Not yet implemented** |

---

## 🚫 Out of Scope / Deferred

| Feature | Reason |
|---------|--------|
| Cron via Cloudflare Triggers | Replaced by external POST with secret |
| ORM layer | Using `@supabase/supabase-js` directly |
| PDF-to-image rendering | Browser rendering via Cloudflare Browser API (not configured) |
| Webhooks (user-facing) | Skipped for minimal implementation |

---

## Environment Variables Summary

### Backend — Required for Production

```bash
# Already configured
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET, APP_URL, RESEND_API_KEY, FROM_EMAIL
STORAGE_PROVIDER, SUPABASE_STORAGE_*
TSA_URL, CRON_SECRET

# ⚠️ Stripe billing (requires real values)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC_USD=price_...
STRIPE_PRICE_PRO_USD=price_...
STRIPE_PRICE_ENTERPRISE_USD=price_...
STRIPE_CUSTOMER_PORTAL=https://billing.stripe.com/...

# ⏳ Tranzila (deferred)
TRANZILA_TERMINAL_ID=
TRANZILA_SECRET=
```

### Frontend

```bash
VITE_API_URL=https://your-api-domain.com
```

---

## Architecture Summary

```
Frontend (React + Vite + Tailwind)
    │
    ▼
Backend (Hono + Cloudflare Workers)
    ├── /auth          — register, login, logout
    ├── /users         — profile, admin
    ├── /documents     — upload, list, send, download
    ├── /signing       — signer token, sign action
    ├── /teams         — CRUD, members
    ├── /referrals     — stats, validation
    ├── /dashboard     — stats, onboarding
    ├── /api-keys      — create, list, revoke
    ├── /billing       — checkout, portal, invoices, webhook
    └── /email-worker  — cron-triggered email sender
              │
              ▼
        Supabase (Postgres + Storage)
              │
              ▼
        Cloudflare R2 (optional storage)
```

---

## Pricing Tiers (UI)

| Plan | Price | Status |
|------|-------|--------|
| Free | ₪0/mo | ✅ Working — no checkout needed |
| Basic | ₪30/mo (ILS) / $8 (USD) | 🔧 Stripe not yet configured |
| Pro | ₪120/mo (ILS) / $100 (USD) | 🔧 Stripe not yet configured |
| Enterprise | Contact us | 📋 Manual sales process |

---

*This report reflects the state of the codebase as of May 15, 2026. Items marked 🔧 require configuration or setup before going live. Items marked ⏳ are deferred to a future phase.*