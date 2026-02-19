# CertWall Architecture Review

**Date:** 2026-02-18
**Reviewer:** Claude Opus 4.6 (Architectural Review Agent)
**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui + Supabase + Stripe + OpenAI

---

## Executive Summary

CertWall is a Certificate of Insurance (COI) compliance management platform for property managers. The codebase is relatively young (no git history committed yet) and implements a solid MVP covering COI upload, AI-powered extraction via GPT-4o vision, compliance scoring, expiry reminders, audit export, multi-tenant org/team management, and Stripe billing.

**Overall Assessment:** The architecture is sound for an early-stage product. The separation between marketing pages, app shell, and API routes is clean. Auth and multi-tenancy patterns are well implemented. However, there are several critical and high-severity issues -- particularly around secrets management, N+1 query patterns, missing input validation at API boundaries, and the hardcoded dev storage bucket name -- that must be addressed before production deployment.

**Finding Counts by Severity:**
- Critical: 4
- High: 11
- Medium: 14
- Low: 8

---

## CRITICAL Findings

### C1. Real API Keys Committed in `.env.local`

- **Severity:** Critical
- **File:** `C:\Cursor\CertWall\.env.local` (lines 4, 8, 13)
- **Description:** The `.env.local` file contains real Supabase service role keys and an OpenAI API key (`sk-proj-...`). While `.env*` is listed in `.gitignore` (line 34) and no commits exist yet, this file is sitting in the working directory alongside a `.git` repo. A single `git add -A` or `git add .` would expose all secrets in git history permanently. The `.env.example` file (line 5) also references an `ANTHROPIC_API_KEY` that doesn't match the actual `OPENAI_API_KEY` used, suggesting the example is stale/misleading.
- **Recommended Fix:**
  1. Rotate ALL keys immediately (Supabase service role key, OpenAI key).
  2. Add `.env.local` to a pre-commit hook check.
  3. Update `.env.example` to list ALL required env vars (without values) including `OPENAI_API_KEY`, all `STRIPE_*` vars, and `NEXT_PUBLIC_APP_URL`.
  4. Consider using a secrets manager (Vercel environment variables, Doppler, etc.).
- **Effort:** Small

### C2. Hardcoded Dev Storage Bucket Name in Production Code

- **Severity:** Critical
- **Files:**
  - `C:\Cursor\CertWall\src\app\api\upload\route.ts` (line 74)
  - `C:\Cursor\CertWall\src\app\api\extract\route.ts` (line 44)
  - `C:\Cursor\CertWall\src\app\api\export\route.ts` (lines 66, 88, 102)
- **Description:** The Supabase storage bucket name `'coi-docs-dev'` is hardcoded in 5 locations across 3 API routes. There is no mechanism to switch to a production bucket. Deploying to production with this code will either fail (if the bucket doesn't exist) or mix dev and production data.
- **Recommended Fix:** Extract the bucket name to an environment variable (`COI_STORAGE_BUCKET`) and reference it everywhere. Create a constants file:
  ```typescript
  export const STORAGE_BUCKET = process.env.COI_STORAGE_BUCKET || 'coi-docs-dev';
  ```
- **Effort:** Trivial

### C3. No File Size Limit Enforced Server-Side on Upload

- **Severity:** Critical
- **File:** `C:\Cursor\CertWall\src\app\api\upload\route.ts` (lines 17-19)
- **Description:** The upload API route reads the entire file into memory (`file.arrayBuffer()` at line 48) without any server-side size validation. The client shows a 4MB warning (upload-form.tsx line 134) but does not prevent submission -- it's purely a visual hint. An attacker could upload arbitrarily large files, causing memory exhaustion and DoS. The `pdf-to-img` conversion (extract route line 59) with `scale: 2.0` further amplifies memory usage for large PDFs.
- **Recommended Fix:**
  1. Add a `bodyParser` size limit in `next.config.ts` or check `file.size` before reading into memory.
  2. Enforce the 4MB limit server-side: `if (file.size > 4 * 1024 * 1024) return 413;`
  3. Consider streaming uploads to storage instead of buffering entirely in memory.
- **Effort:** Small

### C4. No Input Validation (Zod) at API Boundaries

- **Severity:** Critical
- **Files:** All 13 API routes that call `request.json()`
  - `C:\Cursor\CertWall\src\app\api\vendors\route.ts` (line 32)
  - `C:\Cursor\CertWall\src\app\api\vendors\[id]\route.ts` (line 16)
  - `C:\Cursor\CertWall\src\app\api\extract\route.ts` (line 22)
  - `C:\Cursor\CertWall\src\app\api\compliance\score\route.ts` (line 12)
  - `C:\Cursor\CertWall\src\app\api\billing\checkout\route.ts` (line 14)
  - `C:\Cursor\CertWall\src\app\api\team\invite\route.ts` (line 14)
  - `C:\Cursor\CertWall\src\app\api\team\invite\accept\route.ts` (line 15)
  - `C:\Cursor\CertWall\src\app\api\team\[userId]\role\route.ts` (line 16)
  - `C:\Cursor\CertWall\src\app\api\user\profile\route.ts` (line 41)
  - `C:\Cursor\CertWall\src\app\api\support\tickets\route.ts` (line 29)
  - `C:\Cursor\CertWall\src\app\api\support\tickets\[id]\route.ts` (line 47)
  - `C:\Cursor\CertWall\src\app\api\support\tickets\[id]\reply\route.ts` (line 13)
  - `C:\Cursor\CertWall\src\app\api\auth\setup-org\route.ts` (line 16)
- **Description:** Despite having Zod installed (package.json line 37, used in client forms), NO API route validates request bodies with a schema. Every route destructures `request.json()` directly and does only minimal `if (!field)` checks. This allows:
  - Unexpected types (strings where numbers expected, nested objects, etc.)
  - Injection of extra fields that get passed to Supabase `.insert()` / `.update()`
  - `trade_type` accepts any string, not validated against the enum
  - `role` in invite route only partially validated (line 69-73)
  - `priority` in support ticket accepts any value (line 45: `priority || 'medium'`)
- **Recommended Fix:** Create Zod schemas for every API endpoint's request body. Example:
  ```typescript
  const vendorSchema = z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().optional(),
    trade_type: z.enum(['GC', 'HVAC', 'CLEANING', ...]),
    // ...
  });
  const body = vendorSchema.parse(await request.json());
  ```
- **Effort:** Medium

---

## HIGH Findings

### H1. N+1 Query Pattern in Compliance Dashboard API

- **Severity:** High
- **File:** `C:\Cursor\CertWall\src\app\api\compliance\route.ts` (lines 21-51)
- **Description:** The compliance GET endpoint fetches all vendors, then for EACH vendor makes 2 additional queries (compliance status + latest document) using `Promise.all` inside a `.map()`. For an org with 200 vendors, this fires 400+ database queries per single dashboard load. This is the primary dashboard endpoint called on every page load.
- **Recommended Fix:** Replace with a single query using Supabase joins:
  ```typescript
  const { data } = await supabase
    .from('cw_vendors')
    .select('*, cw_compliance_status(*), cw_documents(created_at)')
    .eq('org_id', context.orgId)
    .order('name');
  ```
  Or create a database view that joins vendors with their compliance status and latest document date.
- **Effort:** Medium

### H2. N+1 Query Pattern in Export API

- **Severity:** High
- **File:** `C:\Cursor\CertWall\src\app\api\export\route.ts` (lines 30-77)
- **Description:** The export endpoint iterates over all vendors with a `for...of` loop, making 2-3 sequential queries per vendor (compliance + latest doc + PDF download). For 200 vendors, this is 600+ queries plus 200 file downloads, all within a single request with a 60-second timeout. This will time out for orgs with more than ~50 vendors.
- **Recommended Fix:**
  1. Use batched queries (single query with joins for all data).
  2. Download PDFs in parallel with concurrency limiting.
  3. For large orgs, consider a background job that generates the export and notifies when ready.
- **Effort:** Large

### H3. N+1 Query Pattern in Reminders API

- **Severity:** High
- **File:** `C:\Cursor\CertWall\src\app\api\reminders\route.ts` (lines 33-91)
- **Description:** The reminders POST endpoint fetches all compliance statuses, then for each one with an expiry date, makes 1-2 deduplication queries plus an insert. For an org with 200 vendors, this could be 400+ queries.
- **Recommended Fix:** Batch the deduplication check: fetch all existing reminder logs for the org in one query, then check against the in-memory set before inserting.
- **Effort:** Medium

### H4. Deprecated `getSupabaseServer()` Function Still Exists

- **Severity:** High
- **File:** `C:\Cursor\CertWall\src\lib\supabase\server.ts` (lines 47-58)
- **Description:** The `getSupabaseServer()` function is marked `@deprecated` but still exists and references `SUPABASE_URL_DEV` / `SUPABASE_SERVICE_ROLE_KEY_DEV` environment variables. While no code currently calls it (confirmed via grep), its presence:
  1. Creates confusion about which client to use
  2. References dev-specific env var names that differ from the production vars
  3. Could be accidentally used by future developers
- **Recommended Fix:** Remove the function entirely. Remove `SUPABASE_URL_DEV` and `SUPABASE_SERVICE_ROLE_KEY_DEV` from `.env.local` (they duplicate the production vars anyway).
- **Effort:** Trivial

### H5. `stripe_customer_id` Exposed to Client via Billing Status API

- **Severity:** High
- **File:** `C:\Cursor\CertWall\src\app\api\billing\status\route.ts` (line 14)
- **Description:** The billing status endpoint returns the `stripe_customer_id` to the client. While this alone isn't directly exploitable (Stripe customer IDs are not secrets in the same way as API keys), it leaks internal infrastructure identifiers that could be used for social engineering or Stripe API abuse if combined with other leaked data.
- **Recommended Fix:** Remove `stripe_customer_id` from the API response. The client doesn't need it -- billing portal creation is handled server-side.
- **Effort:** Trivial

### H6. Service Role Client Used Where RLS Client Would Suffice

- **Severity:** High
- **Files:**
  - `C:\Cursor\CertWall\src\app\api\vendors\route.ts` (lines 9, 31)
  - `C:\Cursor\CertWall\src\app\api\compliance\route.ts` (line 9)
  - `C:\Cursor\CertWall\src\app\api\team\route.ts` (line 9)
  - `C:\Cursor\CertWall\src\app\api\support\tickets\route.ts` (line 9)
  - `C:\Cursor\CertWall\src\app\api\user\profile\route.ts` (lines 15, 44)
- **Description:** Multiple API routes use `createServiceClient()` (which bypasses Row-Level Security) even though they authenticate the user and manually filter by `org_id`. This eliminates the defense-in-depth that RLS provides. If any route accidentally omits the `.eq('org_id', context.orgId)` filter, data from other orgs could leak. The service role client should only be used for operations that genuinely need to bypass RLS (webhooks, org creation, cross-org lookups).
- **Recommended Fix:** Use the RLS-aware `createClient()` for read operations in authenticated routes. Reserve `createServiceClient()` for:
  - Stripe webhook handler
  - Org creation during registration
  - Cross-org operations (invite acceptance)
- **Effort:** Medium

### H7. LLM Response Not Validated Against Schema

- **Severity:** High
- **File:** `C:\Cursor\CertWall\src\lib\claude\extract-coi.ts` (lines 72-78)
- **Description:** The LLM extraction response is parsed as JSON and cast directly to `CoiExtractedFields` (line 72: `parseLLMJson(text) as CoiExtractedFields`). The only validation is a single check on `confidence_score` (line 75). If the LLM returns unexpected field types (string instead of number for limits, incorrect date format, etc.), the data flows unchecked into the database and compliance scorer, potentially causing silent errors or crashes.
- **Recommended Fix:** Validate the parsed JSON against a Zod schema matching `CoiExtractedFields`. Coerce types where reasonable (e.g., string numbers to actual numbers). Return a structured error if validation fails.
- **Effort:** Small

### H8. Misnamed LLM Client Module (`claude/client.ts` Uses OpenAI)

- **Severity:** High (Developer Confusion)
- **Files:**
  - `C:\Cursor\CertWall\src\lib\claude\client.ts`
  - `C:\Cursor\CertWall\src\lib\claude\extract-coi.ts`
- **Description:** The directory is named `claude/` and the `.env.example` references `ANTHROPIC_API_KEY`, but the actual implementation uses OpenAI's API with `gpt-4o`. This is deeply confusing:
  - `.env.example` line 5: `ANTHROPIC_API_KEY=your-anthropic-api-key`
  - `.env.local` line 13: `OPENAI_API_KEY=sk-proj-...`
  - `client.ts` line 1: `import OpenAI from 'openai'`
  - `extract-coi.ts` line 53: `model: 'gpt-4o'`
- **Recommended Fix:** Rename `src/lib/claude/` to `src/lib/llm/` or `src/lib/openai/`. Update `.env.example` to reference `OPENAI_API_KEY`. Keep the module abstracted so swapping LLM providers later is straightforward.
- **Effort:** Small

### H9. No CSRF Protection on State-Mutating API Routes

- **Severity:** High
- **Files:** All POST/PUT/DELETE API routes
- **Description:** Next.js App Router API routes do not have built-in CSRF protection. The application relies solely on cookie-based Supabase auth. While `SameSite=Lax` cookies provide some protection, a targeted CSRF attack from a subdomain or via a crafted form submission could trigger state mutations (delete vendors, send reminders, create invites, export data).
- **Recommended Fix:**
  1. Implement a CSRF token pattern (double-submit cookie or synchronizer token).
  2. Or verify the `Origin`/`Referer` header in a middleware function applied to all mutation routes.
  3. At minimum, require `Content-Type: application/json` headers (which cannot be sent from HTML forms).
- **Effort:** Medium

### H10. Silent Error Swallowing in Client Components

- **Severity:** High
- **Files:**
  - `C:\Cursor\CertWall\src\app\(app)\dashboard\page.tsx` (line 21: `catch { }`)
  - `C:\Cursor\CertWall\src\components\dashboard\export-button.tsx` (line 19: `catch { }`)
  - `C:\Cursor\CertWall\src\components\dashboard\reminder-button.tsx` (line 34: `catch { }`)
  - `C:\Cursor\CertWall\src\components\upload\upload-form.tsx` (line 48: `catch(() => setError(...))`)
- **Description:** Multiple client components silently swallow errors with empty `catch {}` blocks. The dashboard page's `loadData()` function (line 21) fails silently -- users see an empty table with no indication that a network error occurred. The export button (line 19) comments `// silently fail for POC`. These need to become user-facing errors before production.
- **Recommended Fix:** Add error state handling with toast notifications using the already-installed Sonner toaster. Example: `catch { toast.error('Failed to load dashboard data') }`.
- **Effort:** Small

### H11. `(app)/layout.tsx` is `"use client"` -- Prevents Server Components in App Shell

- **Severity:** High
- **File:** `C:\Cursor\CertWall\src\app\(app)\layout.tsx` (line 1)
- **Description:** The app layout is a client component because it manages sidebar collapse state with `useState`. This forces ALL child pages (dashboard, upload, settings, support) to be client components too, preventing the use of server components for data fetching, metadata, and streaming. This is a significant architectural choice that sacrifices Next.js App Router advantages.
- **Recommended Fix:** Extract sidebar state management to a client-only context provider or use URL-based state (cookie/localStorage read in a server component). Make the layout a server component and wrap only the interactive sidebar/topbar parts in client boundaries.
- **Effort:** Medium

---

## MEDIUM Findings

### M1. Duplicated Vendor Limit Constants

- **Severity:** Medium
- **Files:**
  - `C:\Cursor\CertWall\src\lib\types\database.ts` (lines 194-199)
  - `C:\Cursor\CertWall\src\lib\stripe\index.ts` (lines 33-41)
- **Description:** Vendor limits per plan tier are defined in two places: `PLAN_LIMITS` in `database.ts` and `getVendorLimitForTier()` in `stripe/index.ts`. These must be kept in sync manually. If someone updates one and not the other, plan enforcement will be inconsistent.
- **Recommended Fix:** Remove the duplication. Have `getVendorLimitForTier()` use `PLAN_LIMITS` as the single source of truth, or vice versa.
- **Effort:** Trivial

### M2. Duplicate Env Vars (DEV and Production Point to Same Values)

- **Severity:** Medium
- **File:** `C:\Cursor\CertWall\.env.local` (lines 2-4 vs 7-10)
- **Description:** `SUPABASE_URL_DEV`, `SUPABASE_SERVICE_ROLE_KEY_DEV`, and their `NEXT_PUBLIC_` variants contain the exact same values as their non-DEV counterparts. This creates confusion and maintenance burden.
- **Recommended Fix:** Remove all `_DEV` variants. Remove the `getSupabaseServer()` deprecated function that uses them. Standardize on one set of env var names.
- **Effort:** Trivial

### M3. `useUser()` Hook Re-fetches on Every Auth State Change Without Debouncing

- **Severity:** Medium
- **File:** `C:\Cursor\CertWall\src\hooks\use-user.ts` (lines 64-68)
- **Description:** The `onAuthStateChange` listener calls `load()` on every auth event, which triggers 3 Supabase queries (getUser, profile, membership). Auth state can fire multiple times during token refresh, causing redundant fetches. Additionally, a new Supabase client is created on every render cycle (line 25: `const supabase = createClient()` inside useEffect without dependency).
- **Recommended Fix:**
  1. Memoize the Supabase client outside the effect, or create it once at module scope.
  2. Debounce the auth state change handler.
  3. Consider using React Context to share user state across the component tree instead of each component calling `useUser()` independently.
- **Effort:** Small

### M4. Stub Pages with No Functionality

- **Severity:** Medium
- **Files:**
  - `C:\Cursor\CertWall\src\app\(app)\settings\profile\page.tsx` (lines 1-27)
  - `C:\Cursor\CertWall\src\app\(app)\settings\team\page.tsx` (lines 1-27)
  - `C:\Cursor\CertWall\src\app\(app)\settings\billing\page.tsx` (lines 1-27)
  - `C:\Cursor\CertWall\src\app\(app)\support\page.tsx` (lines 1-27)
- **Description:** Four settings/support pages are stubs that display placeholder text ("will be available here") despite having fully-functional API routes for the same features (team management, billing, profile updates, support tickets). The API routes are complete but the UI is disconnected.
- **Recommended Fix:** Wire up the existing API routes to actual UI components, or at minimum add a "Coming Soon" badge and disable the nav links to set user expectations.
- **Effort:** Large (to implement fully), Small (to add "coming soon" indicators)

### M5. Sidebar Nav Items with `disabled: true` Still Rendered

- **Severity:** Medium
- **File:** `C:\Cursor\CertWall\src\components\layout\app-sidebar.tsx` (lines 29-31)
- **Description:** "Vendors" and "Templates" nav items are rendered with `disabled: true` and `href: "#"`. They appear in the sidebar with reduced opacity but are confusing -- clicking them does nothing and the URL doesn't change. There are no vendor management or template management pages.
- **Recommended Fix:** Either remove disabled items from the sidebar until the features are built, or show them with a tooltip/badge indicating "Coming Soon".
- **Effort:** Trivial

### M6. Date Formatting Helper Duplicated

- **Severity:** Medium
- **Files:**
  - `C:\Cursor\CertWall\src\components\dashboard\vendor-table.tsx` (lines 28-35: `formatDate()`)
  - `C:\Cursor\CertWall\src\components\upload\extraction-result.tsx` (lines 18-21: `formatCurrency()`)
- **Description:** Date and currency formatting functions are defined inline in component files rather than shared utility functions. `formatDate` in vendor-table.tsx wraps `date-fns/format` with error handling. `formatCurrency` in extraction-result.tsx is a simple null-check wrapper. As more components need formatting, these will be duplicated further.
- **Recommended Fix:** Create `src/lib/format.ts` with shared `formatDate()`, `formatCurrency()`, and other display formatters.
- **Effort:** Trivial

### M7. CSV Generation Vulnerable to Injection

- **Severity:** Medium
- **File:** `C:\Cursor\CertWall\src\lib\export\generate.ts` (lines 35-49)
- **Description:** The CSV generation wraps `vendor_name` and `missing_items` in double quotes (lines 37, 46) but does not escape double quotes within those values. A vendor name containing `"` would break the CSV format. Additionally, vendor names starting with `=`, `+`, `-`, or `@` could trigger formula injection in Excel (CSV injection attack).
- **Recommended Fix:**
  1. Escape double quotes by doubling them: `value.replace(/"/g, '""')`.
  2. Prefix values starting with `=+-@` with a single quote to prevent formula injection.
  3. Consider using a proper CSV library like `csv-stringify`.
- **Effort:** Small

### M8. No Rate Limiting on Any API Route

- **Severity:** Medium
- **Files:** All API routes under `C:\Cursor\CertWall\src\app\api\`
- **Description:** No API route implements rate limiting. The extract endpoint (which calls the OpenAI API and does PDF-to-image conversion) is particularly expensive. The reminders endpoint triggers database mutations. The auth callback could be brute-forced. Without rate limits, the API is vulnerable to:
  - Cost attacks (repeated extraction calls burn OpenAI tokens)
  - Resource exhaustion (PDF conversion is CPU/memory intensive)
  - Brute-force attacks on invite tokens
- **Recommended Fix:** Implement rate limiting middleware. Options:
  1. Vercel Edge Middleware with `@upstash/ratelimit`
  2. In-memory rate limiting for development
  3. Per-route limits based on criticality (stricter for extract, billing)
- **Effort:** Medium

### M9. No Webhook Endpoint Idempotency

- **Severity:** Medium
- **File:** `C:\Cursor\CertWall\src\app\api\billing\webhook\route.ts` (lines 33-112)
- **Description:** The Stripe webhook handler processes events but has no idempotency check. If Stripe retries a webhook (which it does on failure), the same event could be processed multiple times. While the current update operations are mostly idempotent (upserts on org), future additions (like sending welcome emails or provisioning resources) would not be.
- **Recommended Fix:** Store processed `event.id` values in a database table and check for duplicates before processing. Or use Stripe's built-in idempotency by checking `event.id` uniqueness.
- **Effort:** Small

### M10. Invite Token Not Validated for Email Match

- **Severity:** Medium
- **File:** `C:\Cursor\CertWall\src\app\api\team\invite\accept\route.ts` (lines 4-79)
- **Description:** The invite acceptance endpoint checks that the token is valid and not expired, but does NOT verify that the authenticated user's email matches the email on the invite. This means:
  1. User A is invited as `alice@company.com`
  2. User B who has access to the invite link can register with any email and accept the invite
  3. User B now has the role that was intended for User A
- **Recommended Fix:** Add a check: `if (user.email !== invite.email)` return 403.
- **Effort:** Trivial

### M11. PDF-to-Image Scale Factor Not Configurable

- **Severity:** Medium
- **File:** `C:\Cursor\CertWall\src\lib\pdf\to-images.ts` (line 10)
- **Description:** The PDF rendering scale is hardcoded to `2.0` which produces high-resolution images. This is good for OCR accuracy but bad for memory usage and API costs (larger base64 payloads sent to OpenAI). For a 2-page COI at scale 2.0, each image could be 2-4MB in base64. The extract route limits to 2 pages (line 67) which helps, but the scale should be tunable.
- **Recommended Fix:** Make scale configurable via environment variable or pass it as a parameter. Consider `1.5` as a good balance between quality and performance.
- **Effort:** Trivial

### M12. Missing Database Indexes for Query Patterns

- **Severity:** Medium
- **File:** `C:\Cursor\CertWall\supabase\migrations\001_production_schema.sql` (lines 164-181)
- **Description:** While there are indexes on `org_id` for most tables, several query patterns lack composite indexes:
  - `cw_documents(vendor_id, org_id, created_at DESC)` -- used in compliance and export routes
  - `cw_reminder_log(vendor_id, stage, org_id)` -- used for deduplication
  - `cw_invites(org_id, email, status)` -- used for duplicate invite checks
  - `cw_compliance_status(org_id, vendor_id)` -- primary lookup pattern
- **Recommended Fix:** Add composite indexes matching the most common query patterns.
- **Effort:** Small

### M13. Two Conflicting Migration Strategies

- **Severity:** Medium
- **Files:**
  - `C:\Cursor\CertWall\supabase\migrations\000_all_in_one.sql`
  - `C:\Cursor\CertWall\supabase\migrations\001_production_schema.sql`
  - `C:\Cursor\CertWall\supabase\migrations\001_create_enums.sql` through `007_create_requirements_templates.sql`
- **Description:** There are three sets of migrations that overlap:
  1. Individual POC migrations (001-007) creating tables one by one
  2. `000_all_in_one.sql` which creates everything in one file (including seed data)
  3. `001_production_schema.sql` which ALTERs the POC tables to add multi-tenancy

  The numbering conflicts (two files named `001_*`), and it's unclear which migration path to follow for a fresh database setup.
- **Recommended Fix:** Consolidate into a single migration numbering scheme. For a fresh setup, create a combined migration. Keep the individual POC files only for historical reference. Rename to avoid numbering collisions.
- **Effort:** Small

### M14. `jsPDF` in devDependencies But Used by a Script in the Repo

- **Severity:** Medium
- **File:** `C:\Cursor\CertWall\package.json` (line 47)
- **Description:** `jsPDF` is listed as a devDependency but `generate-synthetic-cois.ts` is a development-only script. This is technically correct, but the script also uses `console.log` directly. More importantly, `gray-matter` and `next-mdx-remote` are in production dependencies (lines 20, 23) but there are no MDX/blog pages implemented. These are unused dependencies increasing bundle size.
- **Recommended Fix:** Remove `gray-matter` and `next-mdx-remote` from dependencies until the blog feature is implemented. They add unnecessary weight to the server bundle.
- **Effort:** Trivial

---

## LOW Findings

### L1. `as unknown as` Type Casts for Supabase Joins

- **Severity:** Low
- **Files:**
  - `C:\Cursor\CertWall\src\app\api\extract\route.ts` (line 40)
  - `C:\Cursor\CertWall\src\app\api\compliance\score\route.ts` (line 29)
  - `C:\Cursor\CertWall\src\app\api\reminders\route.ts` (line 36)
  - `C:\Cursor\CertWall\src\app\api\team\route.ts` (lines 38-40)
  - `C:\Cursor\CertWall\src\components\upload\extraction-result.tsx` (line 24)
  - `C:\Cursor\CertWall\src\app\api\billing\webhook\route.ts` (line 103)
- **Description:** 6 files use `as unknown as` double casts to work around Supabase's inferred types for joined queries. This bypasses TypeScript's type safety for the joined data.
- **Recommended Fix:** Generate proper Supabase types using `supabase gen types typescript` and use the generated types. Alternatively, create typed query helper functions that encapsulate the type assertions.
- **Effort:** Medium

### L2. Inconsistent `"use client"` Quote Style

- **Severity:** Low
- **Files:** Various component files
- **Description:** Some files use `'use client'` (single quotes) while others use `"use client"` (double quotes). For example:
  - Single quotes: `dashboard/page.tsx`, `upload/page.tsx`, `upload-form.tsx`, all dashboard components
  - Double quotes: `layout.tsx`, auth components, sidebar, topbar, mobile-nav, settings pages
- **Recommended Fix:** Enforce consistent quote style via ESLint rule (`quotes: ['error', 'single']` or `'double'`). Run the formatter across all files.
- **Effort:** Trivial

### L3. Auth Error from Supabase Not Logged

- **Severity:** Low
- **File:** `C:\Cursor\CertWall\src\lib\auth\helpers.ts` (lines 22-30)
- **Description:** When `supabase.auth.getUser()` returns an error, the `authError` object is checked but never logged. This makes debugging auth issues difficult in production. The same pattern occurs in the middleware (line 30 of `middleware.ts`).
- **Recommended Fix:** Log auth errors to a structured logging service (or at minimum `console.error` in development). Consider integrating a logging library like `pino`.
- **Effort:** Trivial

### L4. `MarketingFooter` Has Dead Links

- **Severity:** Low
- **File:** `C:\Cursor\CertWall\src\components\layout\marketing-footer.tsx` (lines 10-18)
- **Description:** Footer links for "About", "Contact", "Careers", "Privacy Policy", and "Terms of Service" all point to `"#"`. The Register form (line 164) links to `/terms` and `/privacy` which don't exist. These will 404 or scroll to top, confusing users.
- **Recommended Fix:** Either create placeholder pages for these routes or remove the links until the content exists. At minimum, the `/terms` and `/privacy` links in the register form should point somewhere valid since they relate to legal compliance.
- **Effort:** Small

### L5. Blog Nav Link Points to Non-Existent Route

- **Severity:** Low
- **File:** `C:\Cursor\CertWall\src\components\layout\marketing-nav.tsx` (line 15)
- **Description:** The marketing nav includes a "Blog" link to `/blog`, and `/blog` is listed as a public route in the middleware (line 35). However, no `/blog` page exists. Users clicking this link will see a 404.
- **Recommended Fix:** Remove the Blog link from navigation until the feature is built, or create a placeholder page.
- **Effort:** Trivial

### L6. `AuthCard` Duplicates Logo Component

- **Severity:** Low
- **Files:**
  - `C:\Cursor\CertWall\src\components\auth\auth-card.tsx` (lines 10-16)
  - `C:\Cursor\CertWall\src\components\layout\logo.tsx` (lines 1-29)
- **Description:** `AuthCard` manually renders the CertWall logo with `ShieldCheck` icon and text instead of using the existing `Logo` component. This means the logo rendering is duplicated and could drift.
- **Recommended Fix:** Use `<Logo size="lg" />` in `AuthCard` instead of manually rendering the icon and text.
- **Effort:** Trivial

### L7. Dashboard Page is Entirely Client-Side Rendered

- **Severity:** Low
- **File:** `C:\Cursor\CertWall\src\app\(app)\dashboard\page.tsx` (lines 1-103)
- **Description:** The dashboard uses `useEffect` + `fetch` for client-side data loading, resulting in a loading spinner on every page visit. With Next.js App Router, this could use server components for initial data fetch with streaming, providing instant content on navigation.
- **Recommended Fix:** This is partially blocked by H11 (client layout). Once the layout is fixed, convert the dashboard to a server component that fetches data server-side and streams the vendor table. Use client components only for interactive elements (refresh button, reminder button).
- **Effort:** Medium (dependent on H11)

### L8. No Loading/Error States on Settings Pages

- **Severity:** Low
- **Files:** All stub settings pages (see M4)
- **Description:** The stub pages don't have loading skeletons, error boundaries, or any interactive elements. When these pages are eventually built, adding proper loading states should be part of the implementation.
- **Recommended Fix:** Add `loading.tsx` files in each settings route directory for proper streaming UX. Add error boundaries.
- **Effort:** Small (per page)

---

## Project Structure Assessment

### Current Structure (Good)

```
src/
  app/                          # Next.js App Router pages
    (app)/                      # Authenticated app shell (route group)
      dashboard/page.tsx
      upload/page.tsx
      settings/{profile,team,billing}/page.tsx
      support/page.tsx
      layout.tsx                # App shell layout (sidebar/topbar)
    api/                        # API routes
      auth/setup-org/
      billing/{checkout,portal,status,webhook}/
      compliance/{score}/
      export/
      extract/
      reminders/
      support/tickets/
      team/{invite,invite/accept}/
      upload/
      user/profile/
      vendors/
    auth/{login,register,forgot-password,callback}/
    pricing/
    page.tsx                    # Marketing home
    layout.tsx                  # Root layout
  components/
    ui/                         # shadcn/ui primitives (18 components)
    auth/                       # Auth forms
    dashboard/                  # Dashboard-specific components
    layout/                     # Shell components (sidebar, topbar, nav, footer)
    marketing/                  # Marketing page sections
    upload/                     # Upload flow components
  hooks/                        # Custom React hooks
  lib/
    auth/helpers.ts             # Auth utilities
    claude/                     # LLM integration (misnamed, see H8)
    compliance/{scorer,diff}.ts # Business logic
    export/generate.ts          # Export logic
    pdf/to-images.ts            # PDF processing
    reminders/engine.ts         # Reminder logic
    stripe/index.ts             # Stripe utilities
    supabase/{server,client,middleware}.ts
    types/database.ts           # Type definitions
    utils.ts                    # Tailwind merge utility
  middleware.ts                 # Root middleware
```

### Structural Assessment

**Strengths:**
- Clean separation of marketing vs. app routes using route groups
- Business logic properly extracted to `lib/` (compliance, reminders, export)
- UI components in `components/ui/` follow shadcn/ui conventions
- Feature-specific components grouped logically (dashboard, upload, auth, marketing)
- Consistent file naming (kebab-case for files, PascalCase for components)

**Weaknesses:**
- No `lib/validation/` directory for Zod schemas (see C4)
- No `lib/constants.ts` for shared constants (bucket names, limits)
- No `lib/errors.ts` for custom error types/handling
- No test directory at all -- no unit tests, integration tests, or e2e tests
- `scripts/` contains a test data generator but no npm scripts to run it
- `claude/` directory naming is misleading (H8)

---

## Summary of Recommended Priority Actions

### Before First Commit (Immediate)
1. **Rotate all exposed API keys** (C1)
2. **Update `.env.example`** to list all required vars (C1)
3. **Remove deprecated `getSupabaseServer()`** and `_DEV` env vars (H4, M2)
4. **Rename `claude/` to `llm/`** (H8)

### Before Production Deployment (Sprint 1)
5. **Add Zod validation to all API routes** (C4)
6. **Add server-side file size limit** (C3)
7. **Extract storage bucket to env var** (C2)
8. **Fix N+1 queries in compliance and export** (H1, H2, H3)
9. **Use RLS client where appropriate** (H6)
10. **Validate LLM response schema** (H7)
11. **Add error handling to client components** (H10)
12. **Add rate limiting** (M8)
13. **Verify invite email matches user email** (M10)

### Before Scale (Sprint 2-3)
14. **Fix client layout to enable server components** (H11)
15. **Add composite database indexes** (M12)
16. **Consolidate migrations** (M13)
17. **Implement CSRF protection** (H9)
18. **Add webhook idempotency** (M9)
19. **Wire up stub pages** (M4)
20. **Add comprehensive test coverage** (no tests exist currently)

---

*End of Architectural Review*
