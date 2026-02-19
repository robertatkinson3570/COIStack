# CertWall -- UAT Bug Report Log

**Application:** CertWall -- COI Compliance Management System
**Version:** 1.0 (Production Build)
**Date:** 2026-02-18
**Prepared by:** QA Engineering

---

## Bug Summary

| Bug ID | Severity | Status | Category | Title |
|--------|----------|--------|----------|-------|
| BUG-001 | Major | FIXED | Security | Middleware returned 302 redirect for API routes instead of 401 JSON |
| BUG-002 | Critical | FIXED | Security | CSV injection vulnerability in audit export |
| BUG-003 | Minor | OPEN | UX / Session | No proactive session refresh mechanism |
| BUG-004 | Major | KNOWN | Security | No Zod validation at API request boundaries |
| BUG-005 | Minor | KNOWN | Performance | N+1 query patterns in compliance, export, and reminders APIs |
| BUG-006 | Major | KNOWN | Security | No CSRF protection on state-changing API routes |
| BUG-007 | Minor | FIXED | Maintainability | Storage bucket name hardcoded instead of configurable |

---

## Detailed Bug Reports

---

### BUG-001: Middleware returned 302 redirect for API routes instead of 401 JSON

| Field | Value |
|-------|-------|
| **ID** | BUG-001 |
| **Severity** | Major |
| **Priority** | P0 |
| **Status** | FIXED |
| **Test Case** | SEC-03 |
| **Component** | `src/middleware.ts` |
| **Found By** | E2E test suite |
| **Fixed Date** | 2026-02-18 |

**Description:**
The Next.js middleware was treating API routes (`/api/*`) the same as page routes, issuing a 302 redirect to `/auth/login` when the user was unauthenticated. API clients (fetch, mobile apps, webhooks) expect a `401 Unauthorized` JSON response, not a redirect.

**Steps to Reproduce:**
1. Send `GET /api/vendors` without any authentication cookies.
2. Observe the response.

**Expected Result:**
HTTP 401 response with body `{ "error": "Unauthorized" }`.

**Actual Result (Before Fix):**
HTTP 302 redirect to `/auth/login?redirect=/api/vendors`.

**Resolution:**
Updated `src/middleware.ts` to differentiate between page routes and API routes. API routes now return `NextResponse.json({ error: "Unauthorized" }, { status: 401 })`. Page routes continue to redirect to `/auth/login`.

**Verification:**
E2E tests confirm all 10 API routes return 401 JSON for unauthenticated requests.

---

### BUG-002: CSV injection vulnerability in audit export

| Field | Value |
|-------|-------|
| **ID** | BUG-002 |
| **Severity** | Critical |
| **Priority** | P0 |
| **Status** | FIXED |
| **Test Case** | EXP-02 |
| **Component** | `src/app/api/export/route.ts` |
| **Found By** | Architecture review |
| **Fixed Date** | 2026-02-18 |

**Description:**
The CSV generation in the audit export did not sanitize cell values. If a vendor name or other field contained a value starting with `=`, `+`, `-`, or `@`, opening the CSV in Excel or Google Sheets could execute arbitrary formulas (CSV injection / formula injection attack).

**Steps to Reproduce:**
1. Create a vendor named `=HYPERLINK("http://evil.com","Click me")`.
2. Upload a COI for this vendor.
3. Generate an audit export.
4. Open the CSV in Excel.

**Expected Result:**
The vendor name is displayed as literal text, with no formula execution.

**Actual Result (Before Fix):**
Excel interprets the cell as a formula, potentially executing a hyperlink or command.

**Resolution:**
Added a `sanitizeCsvValue()` helper that escapes cell values beginning with `=`, `+`, `-`, `@`, `\t`, or `\r` by prefixing them with a single quote (`'`). All dynamic values in the CSV are passed through this sanitizer.

**Verification:**
Code review confirmed the sanitizer is applied to all vendor-derived fields in the CSV output.

---

### BUG-003: No proactive session refresh mechanism

| Field | Value |
|-------|-------|
| **ID** | BUG-003 |
| **Severity** | Minor |
| **Priority** | P2 |
| **Status** | OPEN |
| **Test Case** | EDGE-10 |
| **Component** | Client-side session management |
| **Found By** | Code review |

**Description:**
When a user's session token expires during active use, there is no proactive refresh mechanism on the client side. The app relies on Supabase's built-in `onAuthStateChange` listener for token refresh, but there is no explicit handling for the scenario where the refresh itself fails (e.g., the refresh token is also expired). The user experiences an abrupt 401 error or redirect without a clear "session expired" message.

**Steps to Reproduce:**
1. Log in to the application.
2. Wait for the session JWT to expire (default: 1 hour).
3. If the refresh token also fails, attempt any dashboard action.
4. Observe the response.

**Expected Result:**
A clear "Your session has expired, please log in again" message is displayed, and the user is gracefully redirected to `/auth/login`.

**Actual Result:**
The API returns 401. The middleware redirects to `/auth/login`. No user-facing "session expired" message is shown; the experience feels like a silent failure.

**Recommended Fix:**
Add a global auth state listener that detects `SIGNED_OUT` or token refresh failure events and shows a toast notification ("Session expired. Please sign in again.") before redirecting.

**Impact:** Low for POC. Users can still log in again. No data loss occurs.

---

### BUG-004: No Zod validation at API request boundaries

| Field | Value |
|-------|-------|
| **ID** | BUG-004 |
| **Severity** | Major |
| **Priority** | P1 |
| **Status** | KNOWN |
| **Test Case** | N/A (Architectural) |
| **Component** | All API route handlers (`src/app/api/*/route.ts`) |
| **Found By** | Architecture review |

**Description:**
API route handlers do not validate incoming request bodies or query parameters using Zod (or any schema validation library) at the boundary. While client-side forms use Zod schemas for validation, the server-side API routes rely on implicit type assumptions when reading `request.json()`. This means:

- Malformed JSON payloads may cause unhandled exceptions
- Missing required fields may produce cryptic database errors rather than clear 400 responses
- Type coercion issues (e.g., string where number expected) are not caught
- An attacker bypassing the UI could send arbitrary data to the API

**Affected Routes:**
- `POST /api/upload` -- file metadata not schema-validated
- `POST /api/extract` -- extraction payload not validated
- `POST /api/team/invite` -- invite body not validated
- `POST /api/support/tickets` -- partial validation (checks for subject/description existence but no schema)
- `POST /api/billing/checkout` -- tier not validated against allowed values
- `PUT /api/team/{id}/role` -- role not validated against enum
- `PUT /api/support/tickets/{id}` -- status not validated against enum
- `POST /api/user/profile` -- profile data not validated

**Recommended Fix:**
1. Create shared Zod schemas in `src/lib/schemas/` for each API payload.
2. Add a `validateRequest(schema, body)` utility that returns a typed result or 400 error.
3. Apply validation at the top of each route handler before any business logic.

**Impact:** Major for production readiness. Acceptable risk for POC with trusted internal users.

---

### BUG-005: N+1 query patterns in compliance, export, and reminders APIs

| Field | Value |
|-------|-------|
| **ID** | BUG-005 |
| **Severity** | Minor |
| **Priority** | P2 |
| **Status** | KNOWN |
| **Test Case** | N/A (Architectural) |
| **Component** | `src/app/api/compliance/route.ts`, `src/app/api/export/route.ts`, `src/app/api/reminders/route.ts` |
| **Found By** | Architecture review |

**Description:**
Several API routes execute queries inside loops, creating N+1 query patterns:

1. **Compliance API:** Fetches vendors, then for each vendor queries the latest compliance status individually.
2. **Export API:** Fetches vendors, then for each vendor queries documents and downloads PDFs individually.
3. **Reminders API:** Fetches expiring vendors, then for each vendor checks for existing reminders and inserts new ones individually.

**Impact:**
For POC scale (< 75 vendors on Starter plan), the performance impact is negligible. At Growth/Pro/Scale tier limits (200-1000 vendors), response times would degrade significantly.

**Recommended Fix:**
1. Use Supabase joins or batch queries to fetch related data in a single round-trip.
2. For reminders, use a batch insert with conflict handling.
3. For export, use parallel downloads with `Promise.all`.

**Impact:** Minor for POC. Must be addressed before production scaling.

---

### BUG-006: No CSRF protection on state-changing API routes

| Field | Value |
|-------|-------|
| **ID** | BUG-006 |
| **Severity** | Major |
| **Priority** | P1 |
| **Status** | KNOWN |
| **Test Case** | N/A (Architectural) |
| **Component** | All POST/PUT/DELETE API routes |
| **Found By** | Architecture review |

**Description:**
State-changing API routes (POST, PUT, DELETE) do not implement CSRF protection tokens. While Supabase's authentication cookies use `SameSite=Lax` which mitigates most CSRF attacks from cross-origin POST requests, this is not a complete defense:

- `SameSite=Lax` allows GET requests with cookies from cross-origin navigations.
- Older browsers may not enforce `SameSite` correctly.
- Subdomains could potentially be exploited if the cookie domain is broad.

**Mitigating Factors:**
- All state-changing routes use POST/PUT/DELETE (not GET), which are blocked by `SameSite=Lax` from cross-origin form submissions.
- The application uses JSON content types, which cannot be sent via plain HTML forms.
- The Supabase session token is scoped correctly.

**Recommended Fix:**
1. Implement a CSRF token mechanism (e.g., double-submit cookie pattern).
2. Alternatively, verify the `Origin` or `Referer` header matches the expected domain on all state-changing requests.

**Impact:** Major for production with real users. Mitigated for POC by SameSite cookies and JSON-only API.

---

### BUG-007: Storage bucket name hardcoded instead of configurable

| Field | Value |
|-------|-------|
| **ID** | BUG-007 |
| **Severity** | Minor |
| **Priority** | P2 |
| **Status** | FIXED |
| **Test Case** | N/A (Maintainability) |
| **Component** | `src/lib/supabase/storage.ts` (and related files) |
| **Found By** | Architecture review |
| **Fixed Date** | 2026-02-18 |

**Description:**
The Supabase storage bucket name (`coi-documents`) was hardcoded as a string literal in multiple files. This made it difficult to change the bucket name for different environments (development, staging, production) and violated the DRY principle.

**Resolution:**
Extracted the bucket name to a constant in `src/lib/constants.ts`, configurable via the `SUPABASE_STORAGE_BUCKET` environment variable with a default fallback of `"coi-documents"`. All references updated to use the constant.

**Verification:**
Code review confirmed all storage references use the centralized constant.

---

## Statistics

| Category | Count |
|----------|-------|
| Total Bugs | 7 |
| Fixed | 3 |
| Open | 1 |
| Known (Deferred) | 3 |

| Severity | Count | Fixed | Open/Known |
|----------|-------|-------|------------|
| Critical | 1 | 1 | 0 |
| Major | 3 | 1 | 2 |
| Minor | 3 | 1 | 2 |

---

## Recommendations

1. **Before POC Demo:** No action required -- all Critical and blocking bugs are already fixed.
2. **Before Production:** BUG-004 (Zod validation) and BUG-006 (CSRF) must be addressed. BUG-005 (N+1 queries) should be optimized.
3. **Nice to Have:** BUG-003 (session expiry UX) can be addressed as a polish item.
