# COI Grader — Claude Code Implementation Prompt

---

## Part 1: Spec Review & Feasibility Assessment

### Will This Work as a Conversion Wedge? Yes — With Caveats

**What's strong about this spec:**

- The "upload → instant value → gate the save" pattern is proven PLG. It mirrors how Grammarly, Canva, and Loom convert — show the magic, then ask for the email. This is the right instinct.
- The compliance domain has a massive trust gap. PMs and GCs don't believe software can read COIs until they see it work on *their* documents. A free grader collapses that trust gap to 60 seconds.
- The lead data is gold: you know what template they picked (their trade), their compliance posture (pass/fail), and their urgency (non-compliant = hot lead). This is intent data, not just a name and email.
- The funnel is clean: Grader → Email Gate → Trial → CertWall. No awkward pivot.

**What needs to change or tighten for this to actually convert:**

1. **The email gate is too late.** If someone sees a full pass/fail report for free, many won't bother entering an email. Gate the *detailed breakdown* — show the badge (COMPLIANT / NON-COMPLIANT) and the count of issues for free, but blur or collapse the individual check details + extracted values behind the email gate. This is the "freemium blur" pattern. The free preview proves it works; the details are worth an email.

2. **"Pick a template" is friction at the wrong moment.** Most visitors won't know which template maps to their situation. Default to a "Standard Commercial" template and let them change it *after* they see results. The current spec says "default to one but allow selection" — make the default louder and the selection smaller.

3. **The spec is missing the #1 conversion trigger: comparison.** After grading one COI, prompt: "Want to grade your next vendor's COI? Upload another — or import your whole list and track them all." The single-COI grader proves value; the *second* upload proves the workflow pain that CertWall solves.

4. **PDF report generation is over-engineered for v1.** Skip the PDF export at launch. It adds a background job, storage, signed URLs, and a separate email template — all for a feature that doesn't drive trial conversion. Replace with: "Get this report in your CertWall dashboard (free trial)." The PDF becomes a v1.1 feature once you've validated the funnel.

5. **Supabase magic link IS the trial creation flow.** Use `signInWithOtp({ email })` as the email gate. Supabase sends the magic link, verifies the email on click, creates the user if new, and a Postgres trigger auto-sets trial flags. The redirect URL lands them back on their results page, now authenticated with full details unlocked. No ghost accounts (magic link requires click), no separate email system, no custom auth flow. One API call does email capture + verification + trial creation + re-engagement.

6. **Missing: social proof on the results page.** After showing the badge, add: "CertWall users track [X] vendors on average. Start your trial to keep monitoring this COI and all your vendors." Even a static number helps.

7. **Missing: re-engagement hook.** The spec stores results for 30 days but doesn't use them. Send a follow-up email at day 3 and day 7: "Your COI for [vendor] expires in [X] days. Want to track it automatically?" This is where the free grader becomes a nurture engine.

8. **Rate limiting is too generous for abuse, too stingy for power users.** 3/day per IP will frustrate office buildings sharing an IP. Switch to: 5/day per fingerprint (IP + user-agent hash), unlimited for authenticated users. This also creates a natural upgrade nudge: "Want unlimited grading? Start a free trial."

---

## Part 2: Revised Spec Additions (Apply These Before Building)

### Revised Results Page UX (Section 4.3)

```
FREE (no email):
  - Overall badge: COMPLIANT / AT RISK / NON-COMPLIANT
  - Issue count: "3 of 8 checks failed"
  - Top-level status of each check (pass/fail/unknown icons only)
  - CTA: "Enter email to see full details + what to fix"

AFTER EMAIL:
  - Full extracted values per check
  - Confidence indicators
  - "Why it failed" explanations
  - "Next steps" recommendations
  - "Start trial" CTA
```

### Revised Funnel (Section 9)

```
Upload → Free badge + summary → Email gate for details →
  Email sends: results link + "Start free trial" button →
  Day 3 email: "Your COI expires in X days" →
  Day 7 email: "Track all your vendors automatically" →
  Trial signup is always a deliberate action
```

### Revised Templates (Section 5.3) — Add a 4th

```
- Standard Commercial (DEFAULT for public grader)
- General Contractor
- HVAC / Plumbing / Electrical
- Cleaning / Landscaping
```

The "Standard Commercial" template uses moderate minimums and serves as the catch-all. This eliminates the "which template am I?" friction.

---

## Part 3: Claude Code Prompt

> **Copy everything below this line and paste it into Claude Code as your prompt.** Adjust file paths and framework references to match your actual CertWall codebase.

---

```
# Task: Implement COI Grader Feature for CertWall

## Context
I'm adding a public-facing COI (Certificate of Insurance) grading tool to my existing CertWall application. This is a product-led growth feature: visitors upload a COI, get an instant compliance assessment, and are funneled into a CertWall trial.

Before writing any code, please:
1. Read the existing codebase structure to understand the framework, routing patterns, database setup (Supabase/Postgres), auth system, and file storage approach
2. Identify the existing extraction pipeline (if any) for COI documents
3. Check for existing UI component library, design system, and styling approach
4. Review the existing Supabase schema and migration patterns

## What to Build (in order of implementation)

### Phase 1: Database & Backend Foundation

**1.1 — Database migrations**

Create these tables (adjust naming to match existing conventions):

```sql
-- Grader uploads
coi_grader_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token text UNIQUE NOT NULL, -- 22-char URL-safe random token
  account_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- null for public
  email text, -- null until email gate
  file_url text NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('application/pdf', 'image/png', 'image/jpeg')),
  file_size integer NOT NULL CHECK (file_size <= 10485760), -- 10MB
  checksum text,
  source_ip inet,
  holder_name_input text, -- optional certificate holder name for matching
  template_key text NOT NULL DEFAULT 'standard_commercial',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days') -- raw file retention
);

-- Grader results
coi_grader_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES coi_grader_uploads(id) ON DELETE CASCADE,
  overall_status text NOT NULL CHECK (overall_status IN ('compliant', 'at_risk', 'non_compliant')),
  overall_reasons jsonb DEFAULT '[]',
  extracted_json jsonb NOT NULL DEFAULT '{}', -- all extracted fields
  checks_json jsonb NOT NULL DEFAULT '[]', -- array of check results
  confidence_json jsonb DEFAULT '{}',
  needs_review boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Grader events (analytics)
coi_grader_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES coi_grader_uploads(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- upload_created, extraction_started, extraction_done, email_captured, trial_started
  meta_json jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Lead captures
lead_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text NOT NULL DEFAULT 'coi_grader',
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  meta_json jsonb DEFAULT '{}', -- {template_key, overall_status, upload_count}
  UNIQUE(email, source)
);
```

Add RLS policies:
- `coi_grader_uploads`: public can INSERT (for upload), public can SELECT by public_token
- `coi_grader_results`: public can SELECT via JOIN on upload's public_token
- Authenticated users can SELECT/UPDATE their own records (where account_id matches)

Create indexes on: `coi_grader_uploads.public_token`, `coi_grader_uploads.source_ip`, `coi_grader_uploads.email`, `lead_captures.email`.

**1.2 — Compliance templates (config, not DB)**

Create a config file (e.g., `lib/grader/templates.ts` or wherever config lives):

```typescript
export const GRADER_TEMPLATES = {
  standard_commercial: {
    label: "Standard Commercial",
    min_gl_each_occurrence: 1_000_000,
    min_gl_aggregate: 2_000_000,
    wc_required: true,
    auto_required: true,
    additional_insured_required: false,
    waiver_required: false,
    expiry_warning_days: 30,
  },
  general_contractor: {
    label: "General Contractor",
    min_gl_each_occurrence: 1_000_000,
    min_gl_aggregate: 2_000_000,
    wc_required: true,
    auto_required: true,
    additional_insured_required: true,
    waiver_required: true,
    expiry_warning_days: 30,
  },
  hvac_trades: {
    label: "HVAC / Plumbing / Electrical",
    min_gl_each_occurrence: 1_000_000,
    min_gl_aggregate: 2_000_000,
    wc_required: true,
    auto_required: true,
    additional_insured_required: true,
    waiver_required: true,
    expiry_warning_days: 30,
  },
  cleaning_landscaping: {
    label: "Cleaning / Landscaping",
    min_gl_each_occurrence: 500_000,
    min_gl_aggregate: 1_000_000,
    wc_required: true,
    auto_required: false,
    additional_insured_required: false,
    waiver_required: false,
    expiry_warning_days: 30,
  },
};
```

**1.3 — Compliance check engine**

Create `lib/grader/compliance-engine.ts`:

Each check function returns:
```typescript
interface CheckResult {
  check_id: string;
  label: string;
  critical: boolean;
  status: 'pass' | 'fail' | 'unknown';
  value: string | number | null;
  confidence: number; // 0.0–1.0
  reason: string;
  evidence?: string; // snippet or page ref
}
```

Implement these checks against the template config:
1. `expiration_date` — CRITICAL: present, parseable, not expired, warn if within expiry_warning_days
2. `gl_each_occurrence` — CRITICAL: extracted value >= template minimum (unknown if not found)
3. `gl_aggregate` — CRITICAL: extracted value >= template minimum (unknown if not found)
4. `workers_comp_present` — CRITICAL if template requires: detected on document (unknown if not found)
5. `auto_liability_present` — NON-CRITICAL: detected on document
6. `additional_insured_phrase` — NON-CRITICAL: phrase detection ("additional insured")
7. `waiver_of_subrogation_phrase` — NON-CRITICAL: phrase detection ("waiver of subrogation")
8. `certificate_holder_match` — NON-CRITICAL: fuzzy match if holder_name_input was provided

Overall status logic:
- Any critical check `fail` → `non_compliant`
- Any critical check `unknown` OR any non-critical `fail` → `at_risk`
- All pass → `compliant`

IMPORTANT: If a field is not found in extraction, return `unknown` — NEVER fabricate values.

**1.4 — File upload endpoint**

Create the upload API route (match existing patterns, e.g., Next.js API route or Express handler):

```
POST /api/coi-grader/uploads
```

- Accept multipart form data (file + optional holder_name + optional template_key)
- Validate: file type (PDF/PNG/JPEG by MIME + magic bytes), file size <= 10MB, reject password-protected PDFs
- Rate limit: 5 uploads per day per IP+user-agent hash (use existing rate limiting if available, otherwise implement with a simple DB check or Redis)
- Upload file to Supabase Storage (or existing file storage) in a `grader-uploads/` bucket
- Generate a `public_token` (use `nanoid` or `crypto.randomUUID` — 22+ chars, URL-safe)
- Create `coi_grader_uploads` record
- Log `upload_created` event
- Kick off extraction (either inline if fast enough, or via background job — match existing patterns)
- Return `{ public_token, status: 'processing' }`

**1.5 — Extraction pipeline**

Reuse the existing CertWall extraction pipeline if one exists. If not, implement:

```
extractCOIFields(fileUrl: string, fileType: string): Promise<ExtractionResult>
```

Strategy:
1. PDF with text layer → extract text directly (pdf-parse or similar)
2. PDF without text layer / images → OCR (Tesseract, or cloud OCR if already integrated)
3. Parse extracted text for fields using regex patterns + structured LLM extraction (if LLM is available)

Fields to extract:
- policy_expiration_date (required)
- insured_name (best effort)
- certificate_holder (best effort)
- carrier_name (best effort)
- gl_each_occurrence (best effort, parse currency amounts)
- gl_aggregate (best effort)
- auto_liability_present + limit (best effort)
- workers_comp_present (best effort)
- umbrella_limit (best effort)
- additional_insured_phrase_present (boolean, text search)
- waiver_of_subrogation_phrase_present (boolean, text search)

Each field gets a confidence score (0.0–1.0).

If using LLM:
- Enforce JSON schema response
- Require page references
- If field not found → return null/unknown, NEVER hallucinate
- Set temperature to 0

After extraction, run compliance checks, save results to `coi_grader_results`, log `extraction_done` event.

**1.6 — Results API**

```
GET /api/coi-grader/results/:public_token
```

Returns:
- Free tier (no email captured): overall_status, check statuses (pass/fail/unknown icons only, no values or reasons)
- Gated tier (email captured): full extracted values, confidence, reasons, evidence

Check: if `coi_grader_uploads.email IS NOT NULL` for this token → return full data. Otherwise return summary only.

**1.7 — Email gate endpoint (Supabase magic link auth)**

The email gate IS the trial creation. Supabase handles the entire flow.

```
POST /api/coi-grader/results/:public_token/email-gate
```

- Accept `{ email }`
- Validate email format
- Rate limit: 10 submissions per email per day
- Call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/coi-grader/results/:public_token' } })`
- Supabase sends the magic link email automatically
- Upsert `lead_captures` record with meta (template, overall_status)
- Log `email_captured` event
- Return `{ status: 'magic_link_sent' }` — frontend shows "Check your email" message

**On magic link click (user lands back on results page, now authenticated):**

- Supabase client detects the auth session automatically
- If this is a NEW user, a Postgres trigger fires to set up the trial:

```sql
-- Trigger on auth.users insert to auto-create trial profile
CREATE OR REPLACE FUNCTION handle_new_grader_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, plan, trial_started_at, trial_expires_at)
  VALUES (
    NEW.id,
    NEW.email,
    'trial',
    now(),
    now() + interval '14 days'
  )
  ON CONFLICT (id) DO NOTHING; -- existing user, don't overwrite
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_grader_user();
```

- Results page detects auth → backfill `coi_grader_uploads.account_id` with the user's ID
- Full results are now unlocked (details, reasons, extracted values)
- "Attach to vendor" and "Start tracking" actions become available
- No ghost accounts possible: magic link requires actual email click to authenticate

**Customize the Supabase magic link email template** (in Supabase Dashboard → Auth → Email Templates):
- Subject: "Your COI Compliance Report is Ready"
- Body: include the compliance badge result (pass variable via metadata), "Click to view your full report and start your free 14-day trial"
- This replaces the need for a separate email sending system entirely

### Phase 2: Frontend

**2.1 — Public landing page: `/coi-grader`**

Match existing CertWall public page styling. This should feel like part of the product, not a separate microsite.

Layout:
```
[Nav — CertWall logo + "Sign in" link]

HEADLINE: "Is this COI compliant?"
SUBHEAD: "Upload a certificate of insurance. Get instant red flags in under 60 seconds."

[UPLOAD BOX]
  - Drag and drop zone
  - "PDF or image, up to 10MB"
  - Optional text input: "Certificate holder name (for matching)"
  - Template selector: dropdown, default "Standard Commercial", small/subtle
  - [Upload] button

[TRUST LINE]: "No signup required to see your compliance score."

[WHAT WE CHECK — small section]:
  Expiration dates · GL limits · Workers comp · Auto liability
  Additional insured language · Waiver of subrogation · Holder match

[FOOTER]:
  "CertWall checks documents against your rules; it does not verify coverage with carriers."
  "Results may require human review. Not legal or insurance advice."
```

**2.2 — Processing state**

After upload, show inline progress (same page or modal):
```
[✓] Reading document...
[✓] Extracting dates and limits...
[◌] Checking compliance rules...

If >10 seconds: show "Taking longer than usual. We'll have your results shortly."
```

On completion, redirect to `/coi-grader/results/:public_token`

**2.3 — Results page: `/coi-grader/results/:public_token`**

```
[Nav]

COMPLIANCE SNAPSHOT
[BIG BADGE: COMPLIANT (green) / AT RISK (amber) / NON-COMPLIANT (red)]
"3 of 8 checks passed" (or similar summary line)

SCORECARD (always visible):
  ✓ Expiration date         [pass]
  ✗ GL Each Occurrence      [fail]
  ✗ GL Aggregate            [fail]
  ? Workers Comp            [unknown]
  ✓ Auto Liability          [pass]
  ✗ Additional Insured      [fail]
  ✓ Waiver of Subrogation   [pass]
  — Certificate Holder      [not checked]

--- BLUR/GATE LINE ---

[GATED SECTION — collapsed/blurred until email]:
  "Enter your email to see extracted values, failure reasons, and what to fix."
  [Email input] [Unlock Full Report]

  After email:
  - Each check row expands to show:
    - Extracted value (e.g., "$1,000,000")
    - Confidence: High/Med/Low
    - Reason: "GL Each Occurrence of $500,000 is below the $1,000,000 minimum"
    - Next step: "Request updated COI from vendor"
  - "Start CertWall Trial" prominent CTA
  - "Upload another COI" secondary CTA

[FOOTER disclaimers]
```

**2.4 — Authenticated grader: `/app/coi-grader`**

For logged-in users, provide the same grader inside the app shell:
- No email gate (they're already authenticated)
- Full results shown immediately
- Additional actions: "Attach to existing vendor" dropdown, "Create new vendor from this COI", "Start tracking this document" (creates a CertWall tracked document with reminders)
- Match the existing app layout/shell

### Phase 3: Polish & Analytics

**3.1 — Analytics events**

Track via existing analytics system (or simple DB events table):
- `grader_page_view` — landing page loaded
- `upload_started` — file selected
- `upload_completed` — upload + processing done
- `result_viewed` — results page loaded
- `email_captured` — email submitted
- `trial_started` — user clicked trial CTA and signed up
- `vendor_import_started` — authenticated user attached to vendor

**3.2 — Cleanup job**

Create a scheduled job (cron or Supabase edge function on schedule):
- Delete raw files from storage where `expires_at < now()`
- Optionally purge `coi_grader_results` older than 30 days where no account_id

**3.3 — Re-engagement emails (if email system supports scheduled sends)**

- Day 3 after email capture: "Your COI for [insured_name] had [X] issues. Track it automatically with CertWall."
- Day 7: "Still managing COIs manually? Start your free trial."

## Implementation Notes

- Match ALL existing patterns: file structure, naming conventions, component library, API patterns, error handling, auth checks
- Use existing Supabase client and auth helpers — don't create parallel auth flows
- If CertWall already has an extraction pipeline, reuse it entirely — just wire the grader to call it
- The public grader pages should be server-rendered (SEO matters for a lead gen page)
- The public_token should NEVER be guessable — use crypto-grade randomness
- All extracted PII stays within the results payload — never expose in URLs or logs
- Add proper error states for: unsupported file type, file too large, extraction failure, rate limit hit, password-protected PDF

## File Structure Suggestion (adapt to existing patterns)

```
app/ (or pages/ or src/)
├── coi-grader/
│   ├── page.tsx                    # Public landing page
│   └── results/
│       └── [public_token]/
│           └── page.tsx            # Public results page
├── app/
│   └── coi-grader/
│       ├── page.tsx                # Authenticated grader
│       └── results/
│           └── [id]/
│               └── page.tsx        # Authenticated results
api/
├── coi-grader/
│   ├── uploads/
│   │   └── route.ts                # POST upload
│   ├── results/
│   │   └── [public_token]/
│   │       ├── route.ts            # GET results
│   │       └── email-gate/
│   │           └── route.ts        # POST email capture
lib/
├── grader/
│   ├── templates.ts                # Compliance templates config
│   ├── compliance-engine.ts        # Check logic
│   ├── extraction.ts               # COI field extraction
│   └── types.ts                    # Shared types
```

## Order of Operations

1. Read the existing codebase first — understand patterns before writing anything
2. Database migrations
3. Templates config + compliance engine (pure logic, easy to test)
4. Upload endpoint + file storage
5. Extraction pipeline (reuse existing or build minimal)
6. Results API (with free/gated logic)
7. Email gate endpoint
8. Public landing page UI
9. Results page UI
10. Authenticated grader (if time allows — can be Phase 2)
11. Analytics events
12. Cleanup job

## Testing Priorities

1. Compliance engine: unit test each check + overall status logic
2. Upload validation: file type, size, rate limiting
3. Public token security: not guessable, not enumerable
4. Email gate: results are actually gated before email, fully visible after
5. Extraction: graceful handling of bad/empty/password-protected files
```

---

## Part 4: Quick Reference — What Changed from Original Spec

| Original Spec | Revised | Why |
|---|---|---|
| Full results visible free, email gates PDF export | Badge + icons free, email gates details + reasons | More visitors will gate — the badge alone proves it works but isn't actionable without details |
| Template selection upfront | Default to "Standard Commercial," change after | Reduces upload friction |
| Magic link auto-creates trial | ✅ Kept — Supabase `signInWithOtp` + Postgres trigger | Supabase handles this natively: email verification, user creation, and trial flags in one flow. No ghost accounts since magic link requires click. |
| PDF report generation at launch | Deferred to v1.1 | Significant complexity for low conversion impact — the dashboard IS the report |
| 3 templates | 4 templates (added Standard Commercial default) | Catch-all for visitors who don't know their trade category |
| 3 uploads/day per IP | 5 uploads/day per IP+UA hash | Avoids punishing shared IPs; natural upgrade nudge |
| No re-engagement emails | Day 3 + Day 7 follow-ups | The grader data makes these emails highly relevant and personalized |
| No "upload another" prompt | Explicit "Grade another COI" CTA on results | The second upload is where CertWall's workflow value becomes obvious |
