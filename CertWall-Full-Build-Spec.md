# CertWall — Full Application Build Specification

## For: Claude Code Implementation

> **Context**: We have a working POC (proof-of-concept) for CertWall — an automated Certificate of Insurance (COI) compliance management system. The POC validates the core loop: Upload PDF → Extract fields via GPT-4o vision → Score compliance → Remind → Export audit. The POC is built with Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase PostgreSQL + Storage, and OpenAI GPT-4o.
>
> **Goal**: Transform the POC into a production-ready, multi-tenant SaaS application with authentication, billing, professional design, team management, support, SEO, and a marketing site. Every API route and database query must be scoped to the authenticated user's organization. No user should ever see another organization's data.

---

## TABLE OF CONTENTS

1. [Existing POC Summary](#1-existing-poc-summary)
2. [Tech Stack (Final)](#2-tech-stack-final)
3. [Database Schema — Full Production](#3-database-schema--full-production)
4. [Row-Level Security (RLS) Policies](#4-row-level-security-rls-policies)
5. [Authentication System](#5-authentication-system)
6. [Multi-Tenant Organization Model](#6-multi-tenant-organization-model)
7. [Billing & Stripe Integration](#7-billing--stripe-integration)
8. [Design System & Branding](#8-design-system--branding)
9. [Layout & Navigation](#9-layout--navigation)
10. [Page-by-Page Specifications](#10-page-by-page-specifications)
11. [API Routes — Complete](#11-api-routes--complete)
12. [Team Management & Invites](#12-team-management--invites)
13. [Support / Helpdesk](#13-support--helpdesk)
14. [SEO Implementation](#14-seo-implementation)
15. [Blog System](#15-blog-system)
16. [Mobile & Responsive Requirements](#16-mobile--responsive-requirements)
17. [Environment Variables](#17-environment-variables)
18. [Project Structure](#18-project-structure)
19. [Migration & Seed Data](#19-migration--seed-data)
20. [Implementation Order](#20-implementation-order)

---

## 1. EXISTING POC SUMMARY

### What exists and works:
- `/upload` page — vendor select dropdown, PDF file picker (4MB limit), progressive upload status, duplicate detection (SHA-256 checksum), extraction results display with compliance badge, failure reasons, regression warnings, extracted fields, confidence score
- `/dashboard` page — summary cards (compliant/expiring/non-compliant counts), vendor table with status badges, "Run Reminders" button with results dialog, "Export Audit" button with download link
- API routes: `GET /api/vendors`, `POST /api/upload`, `POST /api/extract`, `GET /api/compliance`, `POST /api/compliance/score`, `POST /api/reminders`, `POST /api/export`
- LLM extraction pipeline: PDF → pdf-to-img (PNG) → GPT-4o Vision → structured JSON → compliance scoring → diff detection
- Compliance scorer (pure function): trade-specific rules → RED/YELLOW/GREEN status
- Reminder engine: 30d/14d/7d/1d/expired_weekly stages with dedup
- Audit export: CSV + ZIP with all vendor PDFs, uploaded to Supabase Storage with signed URL

### What the POC does NOT have:
- No authentication (all routes are public)
- No multi-tenancy (single shared dataset)
- No RLS (anyone can read/write everything)
- No billing/payments
- No home/marketing page
- No team management
- No support system
- No SEO
- No blog
- No professional styling (minimal functional UI only)
- No light/dark mode
- No mobile responsiveness
- No user profiles or settings

### POC tables (all prefixed `cw_`):
`cw_vendors`, `cw_documents`, `cw_coi_extractions`, `cw_compliance_status`, `cw_reminder_log`, `cw_requirements_templates`

### POC enums:
`cw_trade_type` (GC, HVAC, CLEANING), `cw_compliance_status_enum` (green, yellow, red), `cw_reminder_stage` (30d, 14d, 7d, 1d, expired_weekly)

---

## 2. TECH STACK (FINAL)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15 (App Router) + TypeScript | Keep from POC |
| UI | Tailwind CSS + shadcn/ui | Expand component usage significantly |
| Theme | next-themes | Light/dark mode |
| Database | Supabase PostgreSQL | Add auth tables, org tables, RLS |
| Auth | Supabase Auth | Email/password + magic link + OAuth (Google) |
| Storage | Supabase Storage | Keep `coi-docs-dev` bucket |
| Payments | Stripe | Checkout, subscriptions, billing portal, webhooks |
| LLM | OpenAI GPT-4o (vision) | Keep from POC |
| PDF | pdf-to-img | Keep from POC |
| Export | archiver | Keep from POC |
| Dates | date-fns | Keep from POC |
| Forms | react-hook-form + zod | Form validation |
| Animation | framer-motion | Page transitions, micro-interactions |
| Icons | lucide-react | Already in shadcn/ui |
| Toast | sonner | Keep from POC |
| Blog | MDX files (local) | Static blog with MDX content |
| SEO | Next.js Metadata API | generateMetadata, sitemap.xml, robots.txt |
| Email (future) | Resend | Not in v1, but structure for it |
| Hosting | Vercel | Serverless, edge |

### Key packages to install:
```bash
npm install @supabase/ssr @supabase/supabase-js next-themes stripe @stripe/stripe-js react-hook-form zod @hookform/resolvers framer-motion
```

---

## 3. DATABASE SCHEMA — FULL PRODUCTION

### IMPORTANT: Keep all existing POC tables but ADD `org_id` column to each one. Add new tables for auth, orgs, billing, support.

### Enum updates:
```sql
-- Extend existing enum
ALTER TYPE cw_trade_type ADD VALUE IF NOT EXISTS 'ELECTRICAL';
ALTER TYPE cw_trade_type ADD VALUE IF NOT EXISTS 'PLUMBING';
ALTER TYPE cw_trade_type ADD VALUE IF NOT EXISTS 'ROOFING';
ALTER TYPE cw_trade_type ADD VALUE IF NOT EXISTS 'LANDSCAPING';
ALTER TYPE cw_trade_type ADD VALUE IF NOT EXISTS 'OTHER';

-- New enums
CREATE TYPE cw_user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE cw_invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
CREATE TYPE cw_plan_tier AS ENUM ('starter', 'growth', 'pro', 'scale');
CREATE TYPE cw_subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
CREATE TYPE cw_ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE cw_ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
```

### NEW TABLE: `cw_organizations`
```sql
CREATE TABLE cw_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan_tier cw_plan_tier NOT NULL DEFAULT 'starter',
  subscription_status cw_subscription_status NOT NULL DEFAULT 'trialing',
  vendor_limit INTEGER NOT NULL DEFAULT 75,
  vendor_count INTEGER NOT NULL DEFAULT 0,
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### NEW TABLE: `cw_user_profiles`
```sql
CREATE TABLE cw_user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### NEW TABLE: `cw_org_memberships`
```sql
CREATE TABLE cw_org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role cw_user_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);
```

### NEW TABLE: `cw_invites`
```sql
CREATE TABLE cw_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role cw_user_role NOT NULL DEFAULT 'member',
  status cw_invite_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, email, status) -- only one pending invite per email per org
);
```

### NEW TABLE: `cw_support_tickets`
```sql
CREATE TABLE cw_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status cw_ticket_status NOT NULL DEFAULT 'open',
  priority cw_ticket_priority NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
```

### NEW TABLE: `cw_ticket_messages`
```sql
CREATE TABLE cw_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES cw_support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  is_staff BOOLEAN NOT NULL DEFAULT FALSE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### MODIFIED EXISTING TABLES — Add `org_id`:

**cw_vendors** — add:
```sql
ALTER TABLE cw_vendors ADD COLUMN org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_vendors ADD COLUMN contact_name TEXT;
ALTER TABLE cw_vendors ADD COLUMN phone TEXT;
ALTER TABLE cw_vendors ADD COLUMN notes TEXT;
ALTER TABLE cw_vendors ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
```

**cw_documents** — add:
```sql
ALTER TABLE cw_documents ADD COLUMN org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_documents ADD COLUMN file_name TEXT NOT NULL DEFAULT '';
ALTER TABLE cw_documents ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cw_documents ADD COLUMN uploaded_by UUID REFERENCES auth.users(id);
```

**cw_coi_extractions** — add:
```sql
ALTER TABLE cw_coi_extractions ADD COLUMN org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_coi_extractions ADD COLUMN review_notes TEXT;
ALTER TABLE cw_coi_extractions ADD COLUMN reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE cw_coi_extractions ADD COLUMN reviewed_at TIMESTAMPTZ;
```

**cw_compliance_status** — add:
```sql
ALTER TABLE cw_compliance_status ADD COLUMN org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE;
-- Change PK from just vendor_id to (vendor_id, org_id) or keep vendor_id as PK since vendor is already org-scoped
```

**cw_reminder_log** — add:
```sql
ALTER TABLE cw_reminder_log ADD COLUMN org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE;
```

**cw_requirements_templates** — restructure:
```sql
-- Change from trade_type PK to per-org templates
ALTER TABLE cw_requirements_templates ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE cw_requirements_templates ADD COLUMN org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_requirements_templates ADD COLUMN name TEXT NOT NULL DEFAULT '';
ALTER TABLE cw_requirements_templates ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
-- Add unique constraint: (org_id, trade_type)
```

### Indexes:
```sql
CREATE INDEX idx_org_memberships_user ON cw_org_memberships(user_id);
CREATE INDEX idx_org_memberships_org ON cw_org_memberships(org_id);
CREATE INDEX idx_vendors_org ON cw_vendors(org_id);
CREATE INDEX idx_documents_org ON cw_documents(org_id);
CREATE INDEX idx_documents_vendor ON cw_documents(vendor_id);
CREATE INDEX idx_extractions_document ON cw_coi_extractions(document_id);
CREATE INDEX idx_extractions_org ON cw_coi_extractions(org_id);
CREATE INDEX idx_compliance_org ON cw_compliance_status(org_id);
CREATE INDEX idx_reminders_org ON cw_reminder_log(org_id);
CREATE INDEX idx_invites_token ON cw_invites(token);
CREATE INDEX idx_invites_org ON cw_invites(org_id);
CREATE INDEX idx_tickets_org ON cw_support_tickets(org_id);
CREATE INDEX idx_ticket_messages_ticket ON cw_ticket_messages(ticket_id);
CREATE INDEX idx_organizations_slug ON cw_organizations(slug);
CREATE INDEX idx_organizations_stripe ON cw_organizations(stripe_customer_id);
```

### Helper function — get user's org_id:
```sql
CREATE OR REPLACE FUNCTION cw_get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM cw_org_memberships
  WHERE user_id = auth.uid()
  ORDER BY joined_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### Trigger — auto-create profile on signup:
```sql
CREATE OR REPLACE FUNCTION cw_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cw_user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION cw_handle_new_user();
```

### Trigger — update vendor_count on org:
```sql
CREATE OR REPLACE FUNCTION cw_update_vendor_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE cw_organizations SET vendor_count = vendor_count + 1 WHERE id = NEW.org_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE cw_organizations SET vendor_count = vendor_count - 1 WHERE id = OLD.org_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vendor_change
  AFTER INSERT OR DELETE ON cw_vendors
  FOR EACH ROW EXECUTE FUNCTION cw_update_vendor_count();
```

---

## 4. ROW-LEVEL SECURITY (RLS) POLICIES

### CRITICAL: Enable RLS on ALL `cw_` tables. Every query through the anon/authenticated client MUST be filtered by the user's organization.

```sql
-- Enable RLS on all tables
ALTER TABLE cw_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_coi_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_compliance_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_reminder_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_requirements_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_ticket_messages ENABLE ROW LEVEL SECURITY;

-- ORGANIZATIONS: users can see orgs they belong to
CREATE POLICY "Users can view their organizations"
  ON cw_organizations FOR SELECT
  USING (id IN (SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Owners can update their organization"
  ON cw_organizations FOR UPDATE
  USING (id IN (SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role = 'owner'));

-- USER PROFILES: users can see profiles of people in their org
CREATE POLICY "Users can view own profile"
  ON cw_user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can view org member profiles"
  ON cw_user_profiles FOR SELECT
  USING (id IN (
    SELECT user_id FROM cw_org_memberships
    WHERE org_id IN (SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid())
  ));

CREATE POLICY "Users can update own profile"
  ON cw_user_profiles FOR UPDATE
  USING (id = auth.uid());

-- ORG MEMBERSHIPS: users can see memberships in their orgs
CREATE POLICY "Users can view memberships in their orgs"
  ON cw_org_memberships FOR SELECT
  USING (org_id IN (SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Owners/admins can insert memberships"
  ON cw_org_memberships FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Owners can delete memberships"
  ON cw_org_memberships FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role = 'owner'
  ) OR user_id = auth.uid()); -- users can remove themselves

-- INVITES: org members can see invites, owners/admins can create
CREATE POLICY "Org members can view invites"
  ON cw_invites FOR SELECT
  USING (org_id IN (SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Owners/admins can create invites"
  ON cw_invites FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Owners/admins can update invites"
  ON cw_invites FOR UPDATE
  USING (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- VENDORS: scoped to org
CREATE POLICY "Org members can view their vendors"
  ON cw_vendors FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members (not viewers) can insert vendors"
  ON cw_vendors FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

CREATE POLICY "Org members (not viewers) can update vendors"
  ON cw_vendors FOR UPDATE
  USING (org_id = cw_get_user_org_id())
  WITH CHECK (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

CREATE POLICY "Owners/admins can delete vendors"
  ON cw_vendors FOR DELETE
  USING (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- DOCUMENTS: scoped to org
CREATE POLICY "Org members can view their documents"
  ON cw_documents FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members (not viewers) can insert documents"
  ON cw_documents FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

-- EXTRACTIONS: scoped to org
CREATE POLICY "Org members can view their extractions"
  ON cw_coi_extractions FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members (not viewers) can insert extractions"
  ON cw_coi_extractions FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

-- COMPLIANCE STATUS: scoped to org
CREATE POLICY "Org members can view compliance"
  ON cw_compliance_status FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "System can upsert compliance"
  ON cw_compliance_status FOR ALL
  USING (org_id = cw_get_user_org_id());

-- REMINDER LOG: scoped to org
CREATE POLICY "Org members can view reminders"
  ON cw_reminder_log FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "System can insert reminders"
  ON cw_reminder_log FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

-- TEMPLATES: scoped to org
CREATE POLICY "Org members can view templates"
  ON cw_requirements_templates FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Owners/admins can manage templates"
  ON cw_requirements_templates FOR ALL
  USING (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- SUPPORT TICKETS: scoped to org
CREATE POLICY "Org members can view their tickets"
  ON cw_support_tickets FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can create tickets"
  ON cw_support_tickets FOR INSERT
  WITH CHECK (org_id = cw_get_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Ticket creator can update"
  ON cw_support_tickets FOR UPDATE
  USING (user_id = auth.uid());

-- TICKET MESSAGES: through ticket's org scope
CREATE POLICY "Users can view messages on their tickets"
  ON cw_ticket_messages FOR SELECT
  USING (ticket_id IN (
    SELECT id FROM cw_support_tickets WHERE org_id = cw_get_user_org_id()
  ));

CREATE POLICY "Users can add messages to their tickets"
  ON cw_ticket_messages FOR INSERT
  WITH CHECK (ticket_id IN (
    SELECT id FROM cw_support_tickets WHERE org_id = cw_get_user_org_id()
  ) AND user_id = auth.uid());
```

### IMPORTANT NOTE FOR API ROUTES:
- **For operations that need to bypass RLS** (like Stripe webhooks updating org records, or the extraction pipeline inserting data), use the **service role client** (`createServiceClient()`).
- **For all user-facing queries**, use the **authenticated client** (`createClient()`) which respects RLS automatically.
- **Every API route that touches org data** must either rely on RLS (preferred) or manually verify the user's org membership before returning data.

---

## 5. AUTHENTICATION SYSTEM

### Provider: Supabase Auth

### Auth methods to support:
1. **Email + Password** (primary)
2. **Magic Link** (passwordless email)
3. **Google OAuth** (optional, nice to have)

### Auth flow:

#### Registration (`/auth/register`):
1. User fills out: full name, email, password, company name
2. Call `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
3. On success, the `cw_handle_new_user` trigger creates a `cw_user_profiles` row
4. **In a server action or API route** (using service role client):
   - Create a `cw_organizations` row with name = company name, slug = slugified company name
   - Create a `cw_org_memberships` row with role = 'owner'
   - Create default `cw_requirements_templates` for all trade types (copy from defaults)
5. Redirect to `/dashboard`
6. Show confirmation email notice if email confirmation is enabled

#### Login (`/auth/login`):
1. Email + password form
2. Call `supabase.auth.signInWithPassword({ email, password })`
3. On success, redirect to `/dashboard` (or `redirect` query param)
4. Show error messages for invalid credentials
5. "Forgot password?" link → `/auth/forgot-password`
6. Magic link option: `supabase.auth.signInWithOtp({ email })`

#### Forgot Password (`/auth/forgot-password`):
1. Email input
2. Call `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/auth/callback?type=recovery' })`
3. Show success message regardless (don't leak whether email exists)

#### Auth Callback (`/auth/callback`):
- Route handler that exchanges code for session
- Handles: email confirmation, password recovery, OAuth callback, magic link
```typescript
// src/app/auth/callback/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
```

#### Middleware (`src/middleware.ts`):
- Refresh session on every request
- Protected routes: `/dashboard`, `/upload`, `/settings/*`, `/support`
- Redirect unauthenticated users to `/auth/login?redirect={path}`
- Redirect authenticated users away from `/auth/login` and `/auth/register` to `/dashboard`
- Public routes (no auth needed): `/`, `/pricing`, `/blog/*`, `/auth/*`, `/api/billing/webhook`

### Logout:
- Call `supabase.auth.signOut()`
- Redirect to `/`

---

## 6. MULTI-TENANT ORGANIZATION MODEL

### Principles:
- Every user belongs to exactly one organization (v1 — simplify)
- The organization is created during registration
- All data (vendors, documents, extractions, compliance, reminders, templates) belongs to an organization
- Users can be invited to an existing organization instead of creating their own
- RLS ensures data isolation at the database level

### Role permissions:

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| View dashboard & compliance | ✅ | ✅ | ✅ | ✅ |
| Upload COIs | ✅ | ✅ | ✅ | ❌ |
| Add/edit vendors | ✅ | ✅ | ✅ | ❌ |
| Delete vendors | ✅ | ✅ | ❌ | ❌ |
| Run reminders | ✅ | ✅ | ✅ | ❌ |
| Export audit | ✅ | ✅ | ✅ | ✅ |
| Invite team members | ✅ | ✅ | ❌ | ❌ |
| Remove team members | ✅ | ❌ | ❌ | ❌ |
| Edit compliance templates | ✅ | ✅ | ❌ | ❌ |
| Manage billing | ✅ | ❌ | ❌ | ❌ |
| Edit org settings | ✅ | ✅ | ❌ | ❌ |
| Create support tickets | ✅ | ✅ | ✅ | ✅ |

### Vendor limit enforcement:
- Before inserting a new vendor, check `org.vendor_count < org.vendor_limit`
- If at limit, return error: "You've reached your plan's vendor limit ({limit}). Upgrade to add more vendors."
- The `vendor_count` is maintained by the trigger on `cw_vendors` insert/delete

### Team member limits by plan:
| Plan | Team Members |
|------|-------------|
| Starter | 3 |
| Growth | 10 |
| Pro | Unlimited |
| Scale | Unlimited |

---

## 7. BILLING & STRIPE INTEGRATION

### Pricing:

| Plan | Vendors | Price | Stripe Price ID env var |
|------|---------|-------|------------------------|
| Starter | Up to 75 | $149/mo | `STRIPE_STARTER_PRICE_ID` |
| Growth | Up to 200 | $299/mo | `STRIPE_GROWTH_PRICE_ID` |
| Pro | Up to 500 | $499/mo | `STRIPE_PRO_PRICE_ID` |
| Scale | 500+ | $799/mo (starting) | `STRIPE_SCALE_PRICE_ID` |

### Trial:
- 14-day free trial on all plans
- No credit card required to start trial
- Trial defaults to Starter plan limits

### Stripe setup:

#### Checkout flow:
1. User clicks "Upgrade" or "Choose Plan" on pricing page or settings
2. `POST /api/billing/checkout` creates a Stripe Checkout Session
   - If org has no `stripe_customer_id`, create customer first
   - Set `metadata.org_id` on both session and subscription
   - `trial_period_days: 14` (if first subscription)
   - `success_url: /settings/billing?session_id={CHECKOUT_SESSION_ID}`
   - `cancel_url: /pricing`
3. Redirect user to Stripe Checkout
4. On success, webhook updates the org

#### Billing portal:
1. User clicks "Manage Billing" in settings
2. `POST /api/billing/portal` creates a Stripe Billing Portal session
3. Redirect to Stripe portal (handles card updates, cancellation, invoice history)

#### Webhook (`POST /api/billing/webhook`):
**This route must NOT require authentication.** Use Stripe webhook signature verification.

Handle these events:
```typescript
// checkout.session.completed — new subscription
// customer.subscription.updated — plan change, renewal
// customer.subscription.deleted — cancellation
// invoice.payment_succeeded — successful payment
// invoice.payment_failed — failed payment
```

Webhook handler logic:
```
checkout.session.completed:
  → Get org_id from session metadata
  → Update org: stripe_customer_id, stripe_subscription_id
  → Set plan_tier based on price ID
  → Set subscription_status = 'active' (or 'trialing' if trial)
  → Set vendor_limit based on plan

customer.subscription.updated:
  → Get org_id from subscription metadata
  → Update plan_tier based on new price ID
  → Update subscription_status
  → Update vendor_limit

customer.subscription.deleted:
  → Set subscription_status = 'canceled'
  → Set plan_tier = 'starter' (downgrade)
  → Set vendor_limit = 75

invoice.payment_failed:
  → Set subscription_status = 'past_due'
```

#### Plan change logic:
- Upgrades: immediate, prorated
- Downgrades: at end of billing period
- If downgrading and vendor_count > new plan limit, show warning but allow (they just can't add more)

### API routes for billing:
```
POST /api/billing/checkout    — Create checkout session
POST /api/billing/portal      — Create billing portal session
POST /api/billing/webhook     — Stripe webhook handler (no auth)
GET  /api/billing/status      — Get current org billing status
```

---

## 8. DESIGN SYSTEM & BRANDING

### Brand Identity:
- **Name**: CertWall
- **Tagline**: "Insurance compliance on autopilot"
- **Voice**: Professional, confident, trustworthy. Not playful or startup-casual. Think "the CFO's favorite tool."
- **Target user**: Property managers managing 200–2,000 units with 50–500 vendor relationships

### Color Palette:

#### Light mode:
- **Background**: Warm off-white (#FAFAF7 / hsl(40, 33%, 98%))
- **Card/Surface**: Slightly warmer (#F7F5F0 / hsl(40, 25%, 97%))
- **Primary (brand green)**: #2D8A49 — used for CTAs, primary buttons, active states
- **Primary hover**: #236E3A
- **Accent gold**: #C9A84C — used sparingly for premium feel, highlights
- **Text primary**: #1A2E22 (very dark green-black)
- **Text secondary**: #6B7C72 (muted green-gray)
- **Border**: #E5E0D5 (warm gray)
- **Status green**: #16A34A
- **Status yellow**: #EAB308
- **Status red**: #DC2626

#### Dark mode:
- **Background**: Deep green-black (#0F1A14 / hsl(160, 18%, 7%))
- **Card/Surface**: Slightly lighter (#172420 / hsl(160, 15%, 10%))
- **Primary**: #45A862 (brighter green for dark bg)
- **Accent gold**: #D4A843
- **Text primary**: #E8E4DC (warm white)
- **Text secondary**: #8B9890 (muted)
- **Border**: #2A3530 (subtle)

### Typography:
- **Display/Headings**: `DM Serif Display` (from Google Fonts) — gives the editorial, premium property-management feel. Fallback: Georgia, serif.
- **Body**: `DM Sans` (from Google Fonts) — clean, modern, pairs perfectly with DM Serif. Fallback: system-ui, sans-serif.
- **Mono** (for data/numbers): `JetBrains Mono` or `IBM Plex Mono`. Fallback: monospace.
- Load via `next/font/google` in the root layout.

### Component styling (shadcn/ui customizations):
- **Buttons**: Rounded (radius ~10px), subtle shadow on primary. Primary = brand green with white text. Secondary = ghost with border. Destructive = red.
- **Cards**: Warm background, subtle border, slight shadow. In dark mode: slightly lighter bg, subtle border glow.
- **Badges (status)**: Semi-transparent background with matching text. GREEN = green-100 bg + green-700 text. Same pattern for YELLOW and RED.
- **Tables**: Clean lines, alternating row colors subtle, hover state.
- **Inputs**: Warm border, focus ring in brand green.
- **Dialogs/Modals**: Centered, backdrop blur, subtle animation.

### Micro-interactions:
- Page transitions: subtle fade + slide-up on route change (framer-motion)
- Cards: slight lift on hover (transform: translateY(-2px) + shadow increase)
- Buttons: gentle press effect on click (scale 0.98)
- Status badges: gentle pulse animation on "red" status
- Loading states: skeleton shimmer effect (not spinners)
- Toast notifications: slide in from top-right (sonner default is fine)

### Logo:
- Text-based logo for now: "CertWall" in DM Serif Display, brand green color
- Optional: small shield/wall icon before the text (use lucide `Shield` or `ShieldCheck`)

### Noise/texture:
- Subtle noise overlay on hero sections and large background areas (CSS SVG noise filter, very low opacity ~3%)
- Adds tactile warmth, avoids flat digital feel

---

## 9. LAYOUT & NAVIGATION

### Two distinct layouts:

#### 1. Marketing layout (`/`, `/pricing`, `/blog/*`)
- **No sidebar**
- Top nav: Logo | Features | Pricing | Blog | Login | "Get Started" CTA button
- Sticky top nav with backdrop blur on scroll
- Footer: Company links, legal, social, newsletter signup placeholder
- No authentication required

#### 2. App layout (`/dashboard`, `/upload`, `/settings/*`, `/support`)
- **Sidebar** (collapsible on mobile):
  - Logo at top
  - Nav items with icons:
    - Dashboard (LayoutDashboard icon)
    - Upload COI (Upload icon)
    - Vendors (Building2 icon) — future page, can be placeholder
    - Templates (FileText icon) — future page, can be placeholder
  - Separator
  - Settings section:
    - Team (Users icon) → `/settings/team`
    - Billing (CreditCard icon) → `/settings/billing`
    - Profile (User icon) → `/settings/profile`
  - Support (HelpCircle icon) → `/support`
  - Separator
  - Org name + plan badge at bottom
  - User avatar + name + dropdown (settings, logout)
- **Top bar** (in app layout):
  - Page title (dynamic)
  - Breadcrumbs (if nested)
  - Theme toggle (sun/moon)
  - Notification bell (placeholder for future)
  - User avatar dropdown
- **Mobile**: Sidebar collapses into hamburger menu, bottom nav optional

### Theme toggle:
- Use `next-themes` with `ThemeProvider`
- Toggle button in top bar: sun icon (light) / moon icon (dark)
- Respect system preference by default
- Persist choice in localStorage

---

## 10. PAGE-BY-PAGE SPECIFICATIONS

### Page 0: Home / Landing (`/`)
**Layout**: Marketing
**Auth**: None required
**SEO**: Title "CertWall — Insurance Compliance on Autopilot", description focused on property managers, COI management

**Sections**:

1. **Hero**
   - Headline: "Stop chasing certificates. Start managing compliance."
   - Subheadline: "CertWall automates COI collection, extraction, and compliance scoring for property managers. Know instantly which vendors are covered — and which aren't."
   - CTA: "Start Free Trial" → `/auth/register`
   - Secondary CTA: "See Pricing" → `/pricing`
   - Hero visual: Abstract illustration or screenshot of dashboard (can be a styled mock/placeholder)
   - Subtle background gradient + noise texture

2. **Social proof bar** (placeholder):
   - "Trusted by 100+ property management companies" (aspirational)
   - Can show placeholder logos or skip for v1

3. **How it works** (3-step):
   - Step 1: "Upload COIs" — "Drop a PDF and our AI reads it in seconds. No manual data entry."
   - Step 2: "Instant Compliance Scoring" — "Every certificate is scored against your requirements. Red, yellow, or green — instantly."
   - Step 3: "Never Miss an Expiry" — "Automated reminders at 30, 14, 7, and 1 day before expiration. Audit-ready exports anytime."
   - Each step has an icon and brief description

4. **Features grid** (6 features):
   - AI-Powered Extraction (Brain/Sparkles icon)
   - Trade-Specific Rules (Settings icon)
   - Expiry Reminders (Bell icon)
   - Regression Detection (TrendingDown icon)
   - Audit Export (Download icon)
   - Team Collaboration (Users icon)
   - Each: icon + title + 1-2 sentence description

5. **Dashboard preview**:
   - Screenshot or mockup of the compliance dashboard
   - "See your entire vendor portfolio at a glance"

6. **Pricing preview**:
   - Brief pricing table or cards (same data as /pricing)
   - CTA to `/pricing` for full details

7. **FAQ section** (5-6 questions):
   - "What is a Certificate of Insurance?"
   - "How does the AI extraction work?"
   - "Is my data secure?"
   - "Can I invite my team?"
   - "What file formats do you support?"
   - "Do you offer a free trial?"

8. **Final CTA section**:
   - "Ready to put your COI compliance on autopilot?"
   - "Start Free Trial" button
   - "No credit card required. 14-day free trial."

9. **Footer**:
   - Logo + tagline
   - Product: Features, Pricing, Blog
   - Company: About, Contact, Careers (placeholder)
   - Legal: Privacy Policy, Terms of Service (placeholder pages)
   - Social: Twitter/X, LinkedIn (placeholder links)
   - © 2026 CertWall. All rights reserved.

---

### Page 1: Pricing (`/pricing`)
**Layout**: Marketing
**Auth**: None required
**SEO**: "Pricing — CertWall", "Simple, transparent pricing for property managers"

**Content**:
- Headline: "Simple pricing that scales with you"
- Subheadline: "Start free for 14 days. No credit card required."
- **4 pricing cards** side by side (2x2 on mobile):

| | Starter | Growth ⭐ Popular | Pro | Scale |
|---|---------|-------------------|-----|-------|
| Price | $149/mo | $299/mo | $499/mo | $799/mo |
| Vendors | Up to 75 | Up to 200 | Up to 500 | 500+ |
| Team | 3 members | 10 members | Unlimited | Unlimited |
| Features | AI extraction, Compliance scoring, Expiry reminders, Audit export, Email support | Everything in Starter + Custom templates, Regression detection, API access, Priority support | Everything in Growth + Advanced analytics, Automated emails, SSO, Custom integrations, Phone support | Everything in Pro + Dedicated account manager, Custom SLAs, White-label, Bulk import, Priority onboarding |
| CTA | "Start Free Trial" | "Start Free Trial" | "Start Free Trial" | "Contact Sales" |

- "Growth" plan should have a "Most Popular" badge and be visually highlighted
- Below cards: "All plans include a 14-day free trial. Cancel anytime."
- Feature comparison table (expandable/accordion or full table below cards)
- FAQ section specific to pricing/billing

---

### Page 2: Auth — Register (`/auth/register`)
**Layout**: Minimal (centered card, no sidebar, no marketing nav — just logo)
**Auth**: Redirect to `/dashboard` if already logged in

**Form fields**:
- Full Name (text)
- Work Email (email)
- Password (password, min 8 chars)
- Company Name (text)
- "Create Account" button
- "Already have an account? Sign in" link
- "By creating an account, you agree to our Terms and Privacy Policy"
- Divider: "Or continue with"
- Google OAuth button (if configured)

**Validation** (react-hook-form + zod):
- Name: required, min 2 chars
- Email: required, valid email
- Password: required, min 8 chars
- Company: required, min 2 chars

**On submit**:
1. `supabase.auth.signUp()`
2. Server action: create org + membership + default templates
3. Redirect to `/dashboard`

---

### Page 3: Auth — Login (`/auth/login`)
**Layout**: Minimal (same as register)
**Auth**: Redirect to `/dashboard` if already logged in

**Form fields**:
- Email
- Password
- "Sign In" button
- "Forgot password?" link
- "Don't have an account? Sign up" link
- Magic link option: "Or sign in with email link"
- Google OAuth button

---

### Page 4: Auth — Forgot Password (`/auth/forgot-password`)
**Layout**: Minimal
- Email input
- "Send Reset Link" button
- Back to login link
- Success state: "Check your email for a reset link"

---

### Page 5: Dashboard (`/dashboard`)
**Layout**: App (sidebar)
**Auth**: Required
**Existing**: Yes, needs upgrade

**Upgrades from POC**:
- Professional card styling with warm colors and subtle shadows
- Status summary cards with icons and trend indicators:
  - ✅ Compliant (green card with ShieldCheck icon)
  - ⚠️ Expiring Soon (yellow card with Clock icon)
  - ❌ Non-Compliant (red card with AlertTriangle icon)
  - 📋 Needs Review (blue card with Eye icon)
  - 📭 No COI (gray card with FileX icon)
- Vendor table improvements:
  - Search/filter bar (search by name, filter by status, filter by trade)
  - Sortable columns
  - Pagination (or virtual scroll for large lists)
  - Click row to expand details or navigate to vendor detail (future)
  - Responsive: card layout on mobile instead of table
- "Run Reminders" button → opens dialog showing results
- "Export Audit" button → shows loading, then download link
- "Add Vendor" button → dialog/form to add new vendor
- Refresh button with subtle rotation animation
- Empty state: when no vendors, show illustration + "Add your first vendor" CTA
- Loading state: skeleton cards + skeleton table rows

---

### Page 6: Upload COI (`/upload`)
**Layout**: App (sidebar)
**Auth**: Required (not viewer role)
**Existing**: Yes, needs upgrade

**Upgrades from POC**:
- Better vendor select with search (combobox style)
- "Add New Vendor" option in the dropdown that opens a mini form
- Drag-and-drop file upload zone with visual feedback
- File validation: PDF only, max 4MB, visual error messages
- Upload progress bar (real progress if possible, or indeterminate)
- Extraction progress: multi-step indicator:
  1. ✅ File uploaded
  2. ⏳ Converting PDF to images...
  3. ⏳ Extracting data with AI...
  4. ⏳ Scoring compliance...
  5. ✅ Complete
- Results panel:
  - Large compliance badge (GREEN/YELLOW/RED) with animation
  - Failure reasons as clear list with red/yellow icons
  - Regression warnings in an alert box (if applicable)
  - Extracted fields in a clean key-value layout
  - Confidence meter (progress bar)
  - "Needs Review" flag prominent if true
  - "Upload Another" button to reset
- Mobile: full-width stacked layout

---

### Page 7: Settings — Profile (`/settings/profile`)
**Layout**: App (sidebar)
**Auth**: Required

- User avatar (with upload capability or Gravatar)
- Full name (editable)
- Email (read-only, shown)
- Password change: "Change Password" button → dialog with current + new password
- "Save Changes" button
- "Delete Account" at bottom (with confirmation dialog — dangerous action)

---

### Page 8: Settings — Team (`/settings/team`)
**Layout**: App (sidebar)
**Auth**: Required (owner/admin for invite actions)

- **Current members table**:
  - Avatar, Name, Email, Role, Joined date
  - Role dropdown (owner/admin can change roles, except can't demote yourself as owner)
  - Remove button (owner only, can't remove yourself)
- **Pending invites**:
  - Email, Role, Status, Sent date, Expires date
  - Revoke button
- **Invite form** (owner/admin only):
  - Email input
  - Role select (member or viewer; admin if you're owner)
  - "Send Invite" button
- Member count vs limit: "3 of 3 members (Starter plan)" with upgrade prompt if at limit
- Team limit enforcement: check against plan limits before sending invite

---

### Page 9: Settings — Billing (`/settings/billing`)
**Layout**: App (sidebar)
**Auth**: Required (owner only)

- **Current plan card**:
  - Plan name + price
  - "Active" / "Trialing" / "Past Due" badge
  - Vendor usage: "45 of 75 vendors used" with progress bar
  - Trial info: "Trial ends in 8 days" (if trialing)
  - Next billing date
- **Plan comparison** (same as pricing page but with "Current Plan" indicated)
- **Actions**:
  - "Change Plan" → Stripe Checkout for upgrade, or confirmation for downgrade
  - "Manage Billing" → Stripe Billing Portal (invoices, payment method, cancel)
- If `subscription_status === 'past_due'`:
  - Alert banner: "Your payment failed. Please update your payment method to continue service."
  - "Update Payment" button → Stripe portal

---

### Page 10: Support (`/support`)
**Layout**: App (sidebar)
**Auth**: Required

- **Create ticket form**:
  - Subject (text)
  - Priority (select: low, medium, high, urgent)
  - Description (textarea)
  - "Submit Ticket" button
- **My tickets list**:
  - Table: Subject, Priority badge, Status badge, Created date, Last updated
  - Click to expand/view ticket detail
- **Ticket detail view** (could be a dialog or sub-page):
  - Full subject + description
  - Status + priority
  - Message thread (chronological)
  - Reply textarea + "Send Reply" button
  - "Close Ticket" button (only if you're the creator)
- **Quick help links** (sidebar or top of page):
  - Getting Started Guide (link to blog post)
  - FAQ (link to home page FAQ or separate page)
  - Email: support@certwall.com

---

### Page 11: Blog Index (`/blog`)
**Layout**: Marketing
**Auth**: None required
**SEO**: Title "Blog — CertWall", description about insurance compliance insights

- Grid of blog post cards (3 columns desktop, 2 tablet, 1 mobile)
- Each card: cover image placeholder, title, excerpt, date, read time, tags
- Click to navigate to `/blog/{slug}`

---

### Page 12: Blog Post (`/blog/[slug]`)
**Layout**: Marketing
**Auth**: None required
**SEO**: Dynamic metadata from blog post frontmatter

- Article layout with max-width prose
- Title, author, date, read time
- MDX content rendered with proper typography (@tailwindcss/typography)
- "Related posts" section at bottom (2-3 cards)
- CTA at bottom: "Ready to automate your COI compliance? Start Free Trial"

---

## 11. API ROUTES — COMPLETE

### Auth-related (handled by Supabase Auth + middleware, not custom routes):
- `GET /auth/callback` — code exchange (already described)

### Billing:
```
POST /api/billing/checkout     — Create Stripe Checkout session
POST /api/billing/portal       — Create Stripe Billing Portal session
POST /api/billing/webhook      — Stripe webhook handler (NO AUTH — use webhook signature)
GET  /api/billing/status       — Return current org billing info
```

### Core (existing, upgraded with auth + org scoping):
```
GET  /api/vendors              — List org's vendors
POST /api/vendors              — Create new vendor (check vendor limit)
PUT  /api/vendors/[id]         — Update vendor
DEL  /api/vendors/[id]         — Delete vendor (owner/admin only)

POST /api/upload               — Upload PDF (auth required, org scoped)
POST /api/extract              — Full extraction pipeline (auth required, org scoped)

GET  /api/compliance           — Dashboard data for org
POST /api/compliance/score     — Re-score extraction

POST /api/reminders            — Run reminder engine for org
POST /api/export               — Generate audit export for org
```

### Team:
```
GET  /api/team                 — List org members + pending invites
POST /api/team/invite          — Send invite (owner/admin)
POST /api/team/invite/accept   — Accept invite (by token)
DEL  /api/team/invite/[id]     — Revoke invite (owner/admin)
PUT  /api/team/[userId]/role   — Change member role (owner only)
DEL  /api/team/[userId]        — Remove member (owner only)
```

### Support:
```
GET  /api/support/tickets            — List org's tickets
POST /api/support/tickets            — Create ticket
GET  /api/support/tickets/[id]       — Get ticket + messages
POST /api/support/tickets/[id]/reply — Add message to ticket
PUT  /api/support/tickets/[id]       — Update ticket status
```

### User:
```
GET  /api/user/profile         — Get current user profile
PUT  /api/user/profile         — Update profile (name, avatar)
```

### EVERY API route pattern (except webhook):
```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // RLS automatically scopes queries to user's org
  // For explicit org_id, use: cw_get_user_org_id() or query membership

  const { data, error } = await supabase
    .from('cw_vendors')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
```

---

## 12. TEAM MANAGEMENT & INVITES

### Invite flow:
1. Owner/admin enters email + role on Team settings page
2. `POST /api/team/invite` checks:
   - User has owner/admin role
   - Org hasn't exceeded team member limit for plan
   - No existing pending invite for that email in this org
   - No existing membership for that email in this org
3. Insert `cw_invites` row with random token + 7-day expiry
4. (Future: send email via Resend with invite link)
5. For v1: show the invite link in the UI so the inviter can copy + send it manually
   - Link format: `{APP_URL}/auth/register?invite={token}` (for new users)
   - Or `{APP_URL}/api/team/invite/accept?token={token}` (for existing users)

### Invite acceptance:
- If user is registering with an invite token:
  1. Create account normally
  2. After signup, check for valid invite matching their email
  3. If found: add them to that org with the invite's role (don't create new org)
  4. Mark invite as 'accepted'
- If existing user clicks accept link:
  1. Verify they're logged in
  2. Verify invite token is valid + not expired
  3. Add membership to the invite's org
  4. Mark invite as 'accepted'
  5. (v1: user can only be in one org, so this replaces their current org — or block if already in one)

---

## 13. SUPPORT / HELPDESK

### Ticket lifecycle:
```
open → in_progress → resolved → closed
       ↑                        |
       └────────── reopen ──────┘ (future)
```

### For v1:
- Users create tickets and can add messages
- Staff replies are manual (via Supabase dashboard or admin panel in future)
- `is_staff = true` messages appear visually different (different background color, "CertWall Support" label)
- No SLA tracking, no auto-assignment, no email notifications (all future)

---

## 14. SEO IMPLEMENTATION

### Technical SEO:
1. **Metadata API**: Every page uses `generateMetadata()` or `export const metadata`
2. **Sitemap** (`/sitemap.xml`):
```typescript
// src/app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://certwall.com';

  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 1 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.8 },
  ];

  // Add blog posts dynamically
  const blogPosts = getBlogSlugs().map(slug => ({
    url: `${baseUrl}/blog/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...blogPosts];
}
```

3. **Robots.txt** (`/robots.txt`):
```typescript
// src/app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/dashboard', '/upload', '/settings', '/support', '/api', '/auth'] },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
```

4. **Open Graph images**: Use Next.js OG image generation or static images for each page
5. **Canonical URLs**: Set on every page
6. **Structured data (JSON-LD)**: Add to home page (Organization, SoftwareApplication) and blog posts (Article)
7. **No-index on app pages**: `/dashboard`, `/upload`, `/settings/*`, `/support` should have `robots: 'noindex'`

### Per-page SEO:

| Page | Title | Description |
|------|-------|-------------|
| `/` | CertWall — Insurance Compliance on Autopilot | Automated COI compliance management for property managers. Upload certificates, extract data with AI, score compliance instantly. |
| `/pricing` | Pricing — CertWall | Simple, transparent pricing for property managers. Plans from $149/mo. 14-day free trial. |
| `/blog` | Blog — CertWall | Insights on insurance compliance, COI management, and risk mitigation for property managers. |
| `/blog/[slug]` | {Post Title} — CertWall Blog | {Post excerpt} |
| `/auth/login` | Sign In — CertWall | Sign in to your CertWall account. |
| `/auth/register` | Create Account — CertWall | Start your free 14-day trial. No credit card required. |
| `/dashboard` | Dashboard — CertWall | noindex |
| `/upload` | Upload COI — CertWall | noindex |

---

## 15. BLOG SYSTEM

### Implementation:
- MDX files stored in `src/content/blog/` directory
- Each file: `{slug}.mdx` with frontmatter
- Use `gray-matter` to parse frontmatter
- Render with `next-mdx-remote` or compile at build time
- Style with `@tailwindcss/typography` (`prose` class)

### Frontmatter schema:
```yaml
---
title: "Your Blog Title"
excerpt: "A brief summary for cards and SEO."
author: "CertWall Team"
authorRole: "Product"
publishedAt: "2026-01-15"
coverImage: "/images/blog/cover-placeholder.jpg"
tags: ["compliance", "property-management"]
readTime: 5
seoTitle: "Optional override for SEO title"
seoDescription: "Optional override for meta description"
---
```

### 10 Blog Posts to Create:

1. **`what-is-a-coi.mdx`**
   - Title: "What Is a Certificate of Insurance (COI)? A Property Manager's Guide"
   - Tags: compliance, basics
   - ~800 words explaining COIs, what they contain, why they matter for property managers

2. **`coi-compliance-risks.mdx`**
   - Title: "The Hidden Risks of Non-Compliant Vendor Insurance"
   - Tags: risk, compliance
   - ~700 words on what happens when vendors aren't properly insured

3. **`automating-coi-tracking.mdx`**
   - Title: "Why Spreadsheets Aren't Enough: Automating COI Tracking"
   - Tags: automation, productivity
   - ~800 words on the problems with manual tracking and the benefits of automation

4. **`understanding-gl-limits.mdx`**
   - Title: "Understanding General Liability Limits: How Much Coverage Do Your Vendors Need?"
   - Tags: insurance, compliance
   - ~700 words explaining GL each-occurrence vs aggregate limits

5. **`workers-comp-requirements.mdx`**
   - Title: "Workers' Compensation Insurance: What Property Managers Need to Know"
   - Tags: insurance, workers-comp
   - ~700 words on workers' comp requirements for different vendor types

6. **`additional-insured-endorsements.mdx`**
   - Title: "Additional Insured Endorsements: Protecting Your Properties"
   - Tags: insurance, endorsements
   - ~700 words on what AI endorsements are and why they're critical

7. **`coi-expiry-management.mdx`**
   - Title: "COI Expiry Management: How to Never Miss a Renewal"
   - Tags: compliance, reminders
   - ~700 words on expiry tracking strategies and reminder systems

8. **`ai-document-extraction.mdx`**
   - Title: "How AI Is Transforming Insurance Document Processing"
   - Tags: AI, technology
   - ~800 words on AI/LLM vision for document extraction, accuracy, and the future

9. **`vendor-compliance-best-practices.mdx`**
   - Title: "Vendor Compliance Best Practices for Property Management Companies"
   - Tags: compliance, best-practices
   - ~800 words on building a vendor compliance program

10. **`choosing-coi-management-software.mdx`**
    - Title: "How to Choose COI Management Software: A Buyer's Guide"
    - Tags: software, guide
    - ~800 words on what to look for in a COI management solution (subtle product pitch)

### Blog helper functions:
```typescript
// src/lib/blog.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');

export function getAllPosts(): BlogPost[] { /* ... */ }
export function getPostBySlug(slug: string): BlogPost | null { /* ... */ }
export function getBlogSlugs(): string[] { /* ... */ }
export function getRelatedPosts(currentSlug: string, tags: string[], limit: number): BlogPost[] { /* ... */ }
```

---

## 16. MOBILE & RESPONSIVE REQUIREMENTS

### Breakpoints (Tailwind defaults):
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

### Key responsive behaviors:

1. **Marketing pages** (home, pricing, blog):
   - Hero: stack vertically on mobile, reduce font sizes
   - Pricing cards: 1 column on mobile, 2 on tablet, 4 on desktop
   - Features grid: 1 column mobile, 2 tablet, 3 desktop
   - Blog grid: 1 column mobile, 2 tablet, 3 desktop
   - Navigation: hamburger menu on mobile

2. **App sidebar**:
   - Desktop (lg+): fixed sidebar, ~256px wide
   - Tablet (md): collapsible sidebar, icon-only mode or overlay
   - Mobile (<md): hidden by default, slide-in overlay from left on hamburger click
   - Bottom nav alternative on mobile: Dashboard, Upload, Settings (3 icons)

3. **Dashboard**:
   - Summary cards: 2 columns on mobile, 4 on desktop
   - Vendor table: transforms to card list on mobile (each vendor = a card with key info)
   - Action buttons: full-width on mobile, inline on desktop

4. **Upload page**:
   - Full-width on mobile, max-width container on desktop
   - Drag-and-drop still works but also has clear "tap to select" for mobile

5. **Forms** (login, register, settings):
   - Max-width ~480px centered on desktop
   - Full-width with padding on mobile

6. **Dialogs/Modals**:
   - Full-screen on mobile (<sm)
   - Centered card on desktop

### Touch targets:
- Minimum 44px height for all interactive elements on mobile
- Adequate spacing between action buttons

---

## 17. ENVIRONMENT VARIABLES

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_GROWTH_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_SCALE_PRICE_ID=price_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=CertWall

# Support
SUPPORT_EMAIL=support@certwall.com
```

---

## 18. PROJECT STRUCTURE

```
src/
  app/
    layout.tsx                           # Root layout: fonts, ThemeProvider, Toaster
    page.tsx                             # Home / landing page (marketing)
    pricing/page.tsx                     # Pricing page (marketing)
    blog/
      page.tsx                           # Blog index
      [slug]/page.tsx                    # Blog post
    auth/
      login/page.tsx                     # Login
      register/page.tsx                  # Register
      forgot-password/page.tsx           # Forgot password
      callback/route.ts                  # Auth callback handler
    (app)/                               # Route group for authenticated app pages
      layout.tsx                         # App layout with sidebar
      dashboard/page.tsx                 # Dashboard
      upload/page.tsx                    # Upload COI
      settings/
        profile/page.tsx                 # User profile
        team/page.tsx                    # Team management
        billing/page.tsx                 # Billing & plan
      support/page.tsx                   # Support tickets
    api/
      vendors/route.ts                   # GET + POST vendors
      vendors/[id]/route.ts             # PUT + DELETE vendor
      upload/route.ts                    # POST upload PDF
      extract/route.ts                   # POST extraction pipeline
      compliance/route.ts               # GET compliance data
      compliance/score/route.ts          # POST re-score
      reminders/route.ts                # POST run reminders
      export/route.ts                    # POST generate audit
      billing/
        checkout/route.ts               # POST create checkout
        portal/route.ts                 # POST create portal session
        webhook/route.ts                # POST Stripe webhook
        status/route.ts                 # GET billing status
      team/
        route.ts                         # GET members + invites
        invite/route.ts                  # POST send invite
        invite/accept/route.ts           # POST accept invite
        invite/[id]/route.ts            # DELETE revoke invite
        [userId]/
          role/route.ts                  # PUT change role
          route.ts                       # DELETE remove member
      support/
        tickets/route.ts                # GET + POST tickets
        tickets/[id]/route.ts           # GET ticket detail, PUT update
        tickets/[id]/reply/route.ts     # POST add message
      user/
        profile/route.ts                # GET + PUT profile
    sitemap.ts                           # Dynamic sitemap
    robots.ts                            # Robots.txt
  components/
    ui/                                  # shadcn/ui components (expanded)
      button.tsx
      card.tsx
      badge.tsx
      input.tsx
      label.tsx
      select.tsx
      dialog.tsx
      dropdown-menu.tsx
      avatar.tsx
      separator.tsx
      switch.tsx
      tabs.tsx
      tooltip.tsx
      table.tsx
      textarea.tsx
      skeleton.tsx
      progress.tsx
      alert.tsx
      sheet.tsx                          # Mobile sidebar
      command.tsx                        # Combobox for vendor search
      popover.tsx
    layout/
      marketing-nav.tsx                  # Top nav for marketing pages
      marketing-footer.tsx               # Footer for marketing pages
      app-sidebar.tsx                    # App sidebar navigation
      app-topbar.tsx                     # App top bar
      mobile-nav.tsx                     # Mobile hamburger menu
      theme-toggle.tsx                   # Light/dark mode toggle
      logo.tsx                           # CertWall logo component
    marketing/
      hero.tsx                           # Landing page hero
      features.tsx                       # Features grid
      how-it-works.tsx                   # 3-step section
      pricing-cards.tsx                  # Pricing cards (shared between / and /pricing)
      faq.tsx                            # FAQ accordion
      cta-section.tsx                    # Final CTA
      social-proof.tsx                   # Social proof bar
    dashboard/
      summary-cards.tsx                  # Status summary cards
      vendor-table.tsx                   # Compliance data table (upgraded)
      vendor-card.tsx                    # Mobile vendor card
      status-badge.tsx                   # R/Y/G badge
      reminder-button.tsx                # Run reminders + dialog
      export-button.tsx                  # Export + download
      add-vendor-dialog.tsx              # Add new vendor form
      vendor-filters.tsx                 # Search + filter controls
    upload/
      upload-form.tsx                    # Vendor select + drag-drop zone
      extraction-result.tsx              # Results display (upgraded)
      progress-steps.tsx                 # Multi-step extraction progress
    auth/
      login-form.tsx                     # Login form component
      register-form.tsx                  # Register form component
      forgot-password-form.tsx           # Reset form
      oauth-buttons.tsx                  # Google button
      auth-card.tsx                      # Wrapper card for auth pages
    blog/
      blog-card.tsx                      # Blog post card for grid
      blog-content.tsx                   # MDX content renderer
      related-posts.tsx                  # Related posts section
    settings/
      profile-form.tsx                   # Profile edit form
      team-table.tsx                     # Team members table
      invite-form.tsx                    # Invite member form
      billing-status.tsx                 # Current plan card
      plan-selector.tsx                  # Plan comparison for upgrade
    support/
      ticket-form.tsx                    # Create ticket form
      ticket-list.tsx                    # Tickets table
      ticket-detail.tsx                  # Ticket view with messages
      ticket-reply.tsx                   # Reply textarea
    shared/
      page-header.tsx                    # Page title + description
      empty-state.tsx                    # Empty state illustration + CTA
      loading-skeleton.tsx               # Reusable skeleton components
      error-boundary.tsx                 # Error display
      confirm-dialog.tsx                 # Confirmation dialog for destructive actions
  lib/
    supabase/
      server.ts                          # Server client (cookie-based auth)
      client.ts                          # Browser client
      middleware.ts                       # Session refresh middleware
    stripe/
      index.ts                           # Stripe client + helpers
    openai/
      client.ts                          # OpenAI SDK singleton
      extract-coi.ts                     # Extraction prompt + JSON parsing
    compliance/
      scorer.ts                          # Pure scoring function
      diff.ts                            # Extraction diff
      templates.ts                       # Default trade templates
    reminders/
      engine.ts                          # Reminder stage logic
    pdf/
      to-images.ts                       # PDF → PNG base64
    export/
      generate.ts                        # CSV + ZIP generation
    blog/
      index.ts                           # Blog post loading + parsing
    seo/
      metadata.ts                        # SEO helper functions
    auth/
      helpers.ts                         # Auth helper functions (requireAuth, requireRole, etc.)
    utils.ts                             # cn(), formatCurrency, formatDate, etc.
  hooks/
    use-user.ts                          # Client-side user hook
    use-org.ts                           # Client-side org hook
    use-media-query.ts                   # Responsive hook
  types/
    database.ts                          # All TypeScript interfaces
  content/
    blog/                                # MDX blog posts
      what-is-a-coi.mdx
      coi-compliance-risks.mdx
      automating-coi-tracking.mdx
      understanding-gl-limits.mdx
      workers-comp-requirements.mdx
      additional-insured-endorsements.mdx
      coi-expiry-management.mdx
      ai-document-extraction.mdx
      vendor-compliance-best-practices.mdx
      choosing-coi-management-software.mdx
  styles/
    globals.css                          # Tailwind base + custom properties
  middleware.ts                          # Next.js middleware (auth + route protection)

public/
  images/
    og-default.png                       # Default Open Graph image
    blog/                                # Blog cover images (placeholder)
  icons/
    favicon.ico
    apple-touch-icon.png

supabase/
  migrations/
    001_production_schema.sql            # Full production schema (new)

scripts/
  generate-synthetic-cois.ts             # Keep from POC

next.config.ts
tailwind.config.ts
tsconfig.json
package.json
.env.example
```

---

## 19. MIGRATION & SEED DATA

### Single migration file approach:
Create one comprehensive migration (`001_production_schema.sql`) that:
1. Creates all enums (with IF NOT EXISTS)
2. Creates all new tables
3. Alters existing POC tables to add `org_id` and new columns
4. Creates all indexes
5. Creates all RLS policies
6. Creates all triggers and functions
7. Seeds default data (if desired)

### Seed data:
- Create a demo organization for testing
- Create default templates for all trade types under that org
- Create a few test vendors
- (The synthetic COI generator from POC still works for test PDFs)

---

## 20. IMPLEMENTATION ORDER

Build in this sequence to maintain a working app throughout:

### Phase 1: Foundation (do first)
1. Database migration — run the full production schema
2. Supabase Auth setup — enable email provider, configure redirect URLs
3. Auth pages — register, login, forgot-password, callback
4. Root layout with fonts + ThemeProvider + next-themes
5. Middleware for route protection
6. User profile creation trigger
7. Organization + membership creation on registration

### Phase 2: App Shell
8. App layout with sidebar
9. Marketing layout with nav + footer
10. Theme toggle (light/dark)
11. Logo component
12. Mobile navigation

### Phase 3: Core Upgrade
13. Upgrade all existing API routes with auth + org scoping
14. Upgrade Dashboard page with new styling
15. Upgrade Upload page with new styling
16. Add Vendor CRUD (add/edit/delete)
17. Vendor limit enforcement

### Phase 4: Billing
18. Stripe integration — checkout, portal, webhook
19. Billing settings page
20. Plan enforcement (vendor limits, team limits)

### Phase 5: Team
21. Team management API routes
22. Team settings page
23. Invite flow (create, accept, revoke)
24. Role-based UI restrictions

### Phase 6: Marketing & Content
25. Landing page (all sections)
26. Pricing page
27. Blog system (MDX setup + all 10 posts)
28. SEO (metadata, sitemap, robots, JSON-LD)

### Phase 7: Support & Polish
29. Support ticket system
30. Profile settings page
31. Empty states for all pages
32. Loading skeletons for all pages
33. Error handling and error boundaries
34. Mobile responsiveness pass on all pages
35. Animation and micro-interaction pass

---

## CRITICAL REMINDERS

1. **RLS is mandatory.** Never trust client-side filtering alone. Every table must have RLS enabled with proper policies. Test by trying to access another org's data — it should return empty results, not errors.

2. **Service role client for server operations.** The extraction pipeline, Stripe webhooks, and org creation during registration need the service role client to bypass RLS. All other operations should use the authenticated client.

3. **Vendor limit enforcement.** Check before every vendor insert. The `vendor_count` trigger keeps the count accurate.

4. **Team member limit enforcement.** Check before every invite send and invite acceptance.

5. **Stripe webhook signature verification.** Always verify the webhook signature. Never trust unverified webhook payloads.

6. **No SSR for authenticated pages.** Use `'use client'` for components that need `supabase.auth` on the client. Use server components + `createClient()` for server-side data fetching in authenticated pages.

7. **Storage bucket policy.** The `coi-docs-dev` bucket should be private. File access should go through signed URLs generated server-side. Scope storage paths by org: `{org_id}/cois/{filename}` and `{org_id}/exports/{filename}`.

8. **Blog content is static.** MDX files are committed to the repo. No CMS, no database for blog content. This keeps it simple and fast.

9. **Dark mode must work everywhere.** Test every component in both themes. Use CSS variables for all colors, never hardcode.

10. **Mobile must work everywhere.** Test at 375px width minimum. Tables become cards. Sidebar becomes overlay. Dialogs become full-screen.
