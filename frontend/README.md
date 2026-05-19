# Sigined · Sign. Verify. Own.

A bilingual (Hebrew/English) e-signature platform with cryptographic ownership proof. Compete with DocuSign and 2sign.co.il.

## What's in this repo

This is a **Vite + React + Tailwind** frontend prototype, fully functional with mock data. It demonstrates every screen, flow, and feature the production product should have. A backend developer takes this codebase and wires it to real services (Supabase, Stripe, Resend) per the instructions below.

## Tech stack

- **Vite** — build tool & dev server
- **React 18** — UI framework
- **Tailwind CSS 3** — styling
- **Lucide React** — icons
- **Web Crypto API** — real SHA-256 hashing in browser (no library needed)

No backend yet. State is in-memory. All data lives in `src/mockData.js`.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build → dist/
```

## File structure

```
sigined/
├── index.html              # Entry HTML (loads Google Fonts)
├── package.json            # Dependencies
├── vite.config.js          # Vite + React plugin config
├── tailwind.config.js      # Tailwind theme + custom colors
├── postcss.config.js       # PostCSS pipeline
│
└── src/
    ├── main.jsx            # React entry point
    ├── index.css           # Tailwind imports + base styles
    ├── App.jsx             # Root component, routing, global state
    ├── i18n.js             # All Hebrew + English translations
    ├── mockData.js         # All mock data (customers, campaigns, etc.)
    ├── lib.js              # Utility functions + crypto helpers
    │
    ├── components/
    │   ├── UI.jsx          # Atoms: Logo, StatusPill, PlanPill, RiskPill,
    │   │                   #        Avatar, Sparkline, ToastStack
    │   └── Layout.jsx      # Sidebar, TopBar, NavItem
    │
    └── pages/
        ├── Public.jsx      # Landing page + Pricing page
        ├── User.jsx        # 8 user-area pages (Dashboard, Documents,
        │                   # Templates, Team, Referrals, ApiKeys,
        │                   # Billing, Settings)
        └── Admin.jsx       # 7 admin pages (Overview, Customers, AtRisk,
                            # Automation, Campaigns, Cohorts, Support)
```

## Architecture decisions

**Why a single `view` state for routing?** It's the simplest possible router. When the team wants browser history, deep-linking, and shareable URLs, swap to `react-router-dom` v6 — about a 30-minute migration.

**Why no backend yet?** This codebase is a **specification in code**: it shows the developer exactly what UI to wire up. Mock data shapes mirror what the API will return. Replace `MOCK_*` arrays in `mockData.js` with `fetch()` calls one at a time.

**Why Tailwind only?** No CSS-in-JS, no Sass, no PostCSS plugins beyond what Tailwind needs. Keeps the build trivial and readable.

**Why split files this way?** Public (no auth), User (auth required), Admin (auth + admin role). This split mirrors how the auth middleware will be structured on the backend.

## Production checklist

The frontend is essentially done. To launch:

1. **Backend** — Supabase (Postgres + Auth + Storage). See `docs/SUPABASE.md`.
2. **Payments** — Stripe for USD, Tranzila for ILS (with VAT).
3. **Email** — Resend or Postmark for transactional, automation flows.
4. **Hosting** — Vercel for frontend (free tier handles 100k+ visitors/mo).
5. **Domain** — recommend `sigined.com`.
6. **Monitoring** — Sentry for errors, Plausible for privacy-friendly analytics.

See `הוראות-לאיריס.md` (Hebrew) for the full step-by-step launch playbook.

## Branding

- **Primary** — Amber/gold `#c8924a` (wax-seal color)
- **Background** — Deep ink/navy `#0f1422 → #070a13` (radial gradient)
- **Cream** — `#fdf9f0` (parchment, used in signature canvas)
- **Display font HE** — Frank Ruhl Libre
- **Display font EN** — Fraunces
- **Body HE** — Heebo
- **Body EN** — Manrope
- **Mono** — JetBrains Mono (hashes, code, numbers)

## License

Proprietary. All rights reserved to Leker Projects LLC.
