# Sigil · Developer Brief

**Welcome.** This document tells you everything you need to know to deliver this project successfully.

---

## What you're building

A bilingual (Hebrew/English) e-signature SaaS that competes with DocuSign and 2sign.co.il, but with three things they don't have:

1. **Cryptographic ownership proof** — every signed document gets a SHA-256 fingerprint + an ownership certificate
2. **Automated abandonment recovery** — users who upload but don't sign get an email sequence
3. **Native bilingual** — Hebrew/English with RTL/LTR auto-switching, not an afterthought

## What's in the codebase

The frontend is **complete**. 2,400 lines of clean React + Tailwind, ~15 page views, fully responsive, RTL/LTR working. Mock data lives in `src/mockData.js` — your job is to replace each `MOCK_*` array with real Supabase queries.

```
src/
├── App.jsx                 # Routing + global state
├── i18n.js                 # All translations (HE + EN)
├── mockData.js             # ⬅ Replace these with API calls
├── lib.js                  # Crypto + utility helpers
├── components/
│   ├── UI.jsx              # Reusable atoms
│   └── Layout.jsx          # Sidebar + TopBar
└── pages/
    ├── Public.jsx          # Landing + Pricing
    ├── User.jsx            # 8 user-area pages
    └── Admin.jsx           # 7 admin pages
```

## Your scope

### Phase 1: Foundation (week 1)

**Set up Supabase project**
- Region: `eu-central-1` (Frankfurt)
- Tables: see `docs/SCHEMA.md` (or design from the mock data shapes)
- Set up RLS policies for every table (users only see their own data)
- Storage bucket: `documents` (50GB limit per user on Pro)
- Enable Auth: Email/password + Google OAuth + magic link

**Tech to add**
- TypeScript (migrate the codebase as you go — don't rewrite, just rename `.jsx → .tsx` and add types as you touch each file)
- `@supabase/supabase-js`
- `@supabase/auth-ui-react` for auth components (or build custom)
- `react-router-dom` v6 (replace the `view` state)
- Optional: `react-query` / `tanstack/query` for server state

### Phase 2: Document Workflow (week 2)

The single most important user flow:

1. User uploads a file (PDF/JPG/MP4, up to 200MB)
2. Browser computes SHA-256 (`lib.js → hashFile()`)
3. File uploads to Supabase Storage
4. User places signature fields (drag-drop UI already in code)
5. User invites signers by email
6. Each signer gets a unique signing link
7. Signer signs (canvas drawing, already implemented)
8. When all signers complete → ownership certificate generated
9. Public verification URL: `sigil.app/v/{first-16-chars-of-hash}`

**Critical**: Use Supabase Edge Functions for hash verification. Don't trust client.

### Phase 3: Payments (week 3)

**Stripe** (USD):
- Products: `Basic` ($8/mo), `Pro` ($100/mo), `Enterprise` (custom)
- Webhooks for: `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`
- Customer Portal: enable so users can manage subscription themselves

**Tranzila** (ILS with VAT):
- Recurring billing (monthly)
- 17% Israeli VAT auto-calculated
- Issue Israeli legal invoices (חשבונית מס/קבלה)

**State sync**:
- Single source of truth: `users.plan` field in Postgres
- Webhook → update field → broadcast via Supabase Realtime → UI updates instantly

### Phase 4: Email Automation (week 4)

This is what differentiates us. Build a real engine, not just transactional emails.

**Use Resend + Supabase cron jobs (`pg_cron`)**:

```sql
-- Example: trial-ending campaign, runs daily at 09:00 UTC
SELECT cron.schedule(
  'trial-ending-day-7',
  '0 9 * * *',
  $$
    INSERT INTO email_queue (user_id, template, scheduled_for)
    SELECT id, 'trial_ending_d7', now()
    FROM users
    WHERE trial_ends_at::date = current_date + interval '7 days'
      AND plan = 'trial'
      AND NOT EXISTS (
        SELECT 1 FROM email_log
        WHERE user_id = users.id AND template = 'trial_ending_d7'
      );
  $$
);
```

**Required campaigns**:
1. Welcome series (4 emails over 7 days)
2. Trial ending (4 emails: D-7, D-3, D-1, D+0)
3. Abandoned upload (3 emails: H+1, D+1, D+3)
4. Abandoned signer (2 emails: H+24, D+3)
5. Churn winback (2 emails: D+7 after cancel, D+30)
6. Milestone (1 email at 10 docs, 1 at 100 docs)

**Admin dashboard requirement**: real-time metrics (sent/opened/clicked) per campaign — already designed, just wire to Resend webhooks.

### Phase 5: Production deployment (week 5-6)

- Frontend → Vercel (custom domain `sigil.app`)
- Backend → Supabase (already there)
- DNS → Cloudflare (Matan owns this)
- HTTPS → automatic via Vercel
- Error monitoring → Sentry (free tier)
- Analytics → Plausible
- Status page → Better Stack (optional, $20/mo)

**Performance targets**:
- Largest Contentful Paint < 1.5s
- Cumulative Layout Shift < 0.1
- Time to Interactive < 3.0s
- Lighthouse score 90+ across all categories

**Backups**:
- Supabase auto-backups daily (Pro plan, included)
- Document files: Supabase Storage replicates 3x by default
- Test restore at least once before launch

### Phase 6: Handover

When you're done, deliver:
- [ ] Production URL working on `sigil.app`
- [ ] Admin login credentials in 1Password (shared vault)
- [ ] `OPERATIONS.md` document explaining:
  - How to deploy a code change (one command)
  - How to view production logs
  - How to restart the email cron
  - How to manually issue a refund
  - Common issues and fixes (FAQ for next dev)
- [ ] Screen recording (Loom, 30-60 min) walking through the full architecture
- [ ] 30 days post-launch availability for bug fixes (paid hourly if needed)

## Code style guidelines

- **No `any` in TypeScript.** If you don't know the type, write `unknown` and narrow.
- **No console.log in production.** Use Sentry or a logger.
- **Async/await everywhere.** No raw Promise chains.
- **One component per file.** If a component grows beyond 200 lines, split it.
- **Tailwind only.** No CSS-in-JS, no Sass, no inline styles except for dynamic values.
- **Commit messages**: Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`).
- **PR descriptions**: Always include a screenshot or screen recording.

## What NOT to do

- ❌ Don't add a state management library (Redux, Zustand, etc.) — `useState` + Context is enough
- ❌ Don't add a UI component library (MUI, Chakra, etc.) — Tailwind + Lucide is plenty
- ❌ Don't optimize prematurely — ship first, then profile
- ❌ Don't use ChatGPT/Claude to "rewrite for clarity" — the code is already clear
- ❌ Don't change the visual design without consulting Matan — the brand is locked
- ❌ Don't migrate to Next.js — Vite + React is faster for this scope

## Communication

- **Slack**: primary channel
- **Standup**: Monday 09:00 Israel time, 15 minutes max
- **Demo**: Friday 14:00, 15 minutes
- **Async questions**: tagged in Slack, response within 24h
- **Blockers**: tag @matan immediately

## Compensation

- **Fixed price**: $3,500-5,000 for full scope (preferred)
- **Hourly**: $40-60/h with 80h cap
- **Bonus**: 5% extra if delivered before week 5 with clean handover
- **Payment**: Through Upwork Milestones (no direct payments)

## Questions before you start

1. Confirm you've read this entire document.
2. Confirm you've cloned the repo and run `npm run dev` successfully.
3. Send a 5-minute Loom video walking through your proposed architecture for the email automation engine specifically.

After we receive that, we'll send the NDA and onboarding kit.

---

**Let's build something great.**

— Matan & Iris (Leker Projects LLC)
