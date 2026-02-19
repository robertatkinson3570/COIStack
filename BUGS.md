# CertWall — Bugs Found During E2E Testing

**Date:** 2026-02-18
**Test Framework:** Playwright (Chromium)
**Total Tests:** 42 | Passed: 42 | Failed: 0 (after fixes)

---

## Bugs Found and Fixed

### BUG-001: Middleware Returns Redirect for API Routes Instead of 401 JSON
- **Severity:** Critical
- **File:** `src/lib/supabase/middleware.ts`
- **Description:** When an unauthenticated request hit a protected API route (e.g., `GET /api/vendors`), the middleware redirected to `/auth/login` with a 307 status. API clients following the redirect received a 200 HTML login page instead of a 401 JSON error.
- **Impact:** All API consumers (mobile apps, third-party integrations, fetch calls) would receive HTML instead of JSON errors, breaking error handling.
- **Fix:** Added a check in the middleware: if the pathname starts with `/api/`, return `NextResponse.json({ error: 'Unauthorized' }, { status: 401 })` instead of redirecting.
- **Status:** Fixed

### BUG-002: Native HTML5 Validation Blocks React-Hook-Form Zod Validation (Login Form)
- **Severity:** Minor
- **File:** `src/components/auth/login-form.tsx`
- **Description:** When a user types an invalid email (e.g., "notanemail") and clicks "Sign In", the browser's native `type="email"` validation fires a tooltip popup before react-hook-form's Zod resolver can run. This prevents Zod's inline error messages from appearing.
- **Impact:** Inconsistent validation UX — native browser tooltips instead of the designed inline error messages. The form still correctly blocks submission.
- **Workaround:** Users can still see that submission is blocked. The native tooltip provides an appropriate error message.
- **Recommended Fix:** Add `noValidate` attribute to the `<form>` element to disable native HTML5 validation and let Zod handle all validation consistently.
- **Status:** Documented (cosmetic, not blocking)

---

## Previously Fixed Bugs (Found During UI Polishing / Architectural Review)

| ID | Severity | Description | File | Status |
|----|----------|-------------|------|--------|
| BUG-003 | Critical | Hardcoded storage bucket name `'coi-docs-dev'` across 4 files | Multiple API routes | Fixed — extracted to `src/lib/constants.ts` |
| BUG-004 | Critical | No server-side file size validation on upload | `src/app/api/upload/route.ts` | Fixed — added `MAX_FILE_SIZE` check |
| BUG-005 | High | `stripe_customer_id` leaked in billing status API response | `src/app/api/billing/status/route.ts` | Fixed — removed from response |
| BUG-006 | High | Deprecated `getSupabaseServer()` function still exported | `src/lib/supabase/server.ts` | Fixed — removed |
| BUG-007 | High | Silent error swallowing in dashboard and export | Dashboard page, export button | Fixed — added `toast.error()` |
| BUG-008 | Medium | CSV injection vulnerability in audit export | `src/lib/export/generate.ts` | Fixed — added `escapeCsv()` |
| BUG-009 | Medium | Team invite could be accepted by wrong email | `src/app/api/team/invite/accept/route.ts` | Fixed — added email verification |
| BUG-010 | Low | Dark mode color issues in extraction results, vendor table | Multiple components | Fixed — added `dark:` variants |
| BUG-011 | Low | Auth card had manual logo instead of reusable Logo component | `src/components/auth/auth-card.tsx` | Fixed — use `<Logo />` |
| BUG-012 | Low | GPT-4o branding references in marketing copy | features.tsx, faq.tsx | Fixed — changed to "AI" |

---

## Known Issues (Not Fixed — Documented for Future Sprints)

| ID | Severity | Description | Recommendation |
|----|----------|-------------|----------------|
| KNOWN-001 | High | No Zod validation at API route boundaries | Add Zod schemas to all POST/PUT API routes |
| KNOWN-002 | High | N+1 query pattern in compliance, export, and reminders APIs | Refactor to use joins or batch queries |
| KNOWN-003 | High | No CSRF protection on mutation endpoints | Add CSRF tokens or use SameSite=Strict cookies |
| KNOWN-004 | Medium | Service role client used for some user-scoped queries | Use user client where RLS policies apply |
| KNOWN-005 | Medium | `src/lib/claude/` directory name is misleading (handles LLM abstraction) | Rename to `src/lib/llm/` |
| KNOWN-006 | Low | Client-side layout wraps `(app)` routes, blocking server component optimization | Consider server component layout |
