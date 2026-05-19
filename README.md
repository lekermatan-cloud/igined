# Sigined

## Project Structure

### Backend (`/backend`)

Cloudflare Workers-based backend API server.

**API Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info |
| `/health` | GET | Health check |
| `/auth/register` | POST | Register new user |
| `/auth/login` | POST | User login |
| `/auth/google` | POST | Google OAuth login |
| `/auth/verify-email` | POST | Verify email address |
| `/auth/resend-verification` | POST | Resend verification email |
| `/auth/logout` | POST | User logout |
| `/auth/me` | GET | Get current user |
| `/auth/reset-password` | POST | Request password reset |
| `/auth/update-password` | POST | Update password |
| `/users/me` | GET/PATCH | Get/update current user profile |
| `/users/me/avatar` | PATCH | Update avatar |
| `/users/me/signature` | POST | Save signature |
| `/users/:id` | GET | Get user by ID |
| `/users` | GET | List all users (admin) |
| `/users/:id/suspend` | PATCH | Suspend user (admin) |
| `/users/:id/activate` | PATCH | Activate user (admin) |
| `/documents` | GET/POST | List/create documents |
| `/documents/:id` | GET/PATCH/DELETE | Get/update/delete document |
| `/documents/:id/download` | GET | Download document |
| `/documents/:id/fields` | GET/POST | Get/add field definitions |
| `/documents/:id/send` | POST | Send document to signers |
| `/documents/:id/signers` | GET | List document signers |
| `/documents/:id/self-sign` | POST | Self-sign document |
| `/signing/sign` | POST | Sign a document |
| `/signing/document` | GET | Get document for signing |
| `/signing/verify` | GET/POST | Verify signature |
| `/signing/certificate/:id` | POST | Generate certificate |
| `/teams` | GET | List user teams |
| `/teams/:id` | GET/PATCH | Get/update team |
| `/teams/:id/members` | GET | List team members |
| `/teams/:id/invite` | POST | Invite team member |
| `/teams/:id/members/:userId` | DELETE/PATCH | Remove/update member |
| `/referrals/stats` | GET | Referral statistics |
| `/referrals/validate/:code` | GET | Validate referral code |
| `/dashboard/stats` | GET | Dashboard statistics |
| `/api-keys` | GET/POST | List/create API keys |
| `/api-keys/:id` | DELETE | Revoke API key |
| `/billing/checkout` | POST | Create checkout session |
| `/billing/portal` | POST | Open billing portal |
| `/billing/invoices` | GET | List invoices |
| `/billing/subscription` | GET | Get subscription info |
| `/billing/webhook/stripe` | POST | Stripe webhook handler |

**Backend Stack:** Hono, Cloudflare Workers, Supabase, Stripe

### Frontend (`/frontend`)

Vite-based frontend application with React, Tailwind CSS, and i18n support.

**Features:**
- Document upload and management
- Digital signature with drawn/typed signatures
- Document signing workflow
- PDF viewer with field placement
- Team management and collaboration
- Admin dashboard with analytics, customer management, automation, campaigns, cohorts, and support
- Email verification
- Theme switching (light/dark mode)
- Multi-language support (Hebrew, English)
- Referral system
- API key management
- Stripe billing integration
- Document verification

**Frontend Stack:** React, Vite, Tailwind CSS, React Router, i18next

## Getting Started

1. Install dependencies:
   ```bash
   cd backend && npm install
   cd frontend && npm install
   ```

2. Run development servers:
   - Backend: `npm run dev` (in backend)
   - Frontend: `npm run dev` (in frontend)