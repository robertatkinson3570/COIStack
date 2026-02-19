# CertWall — COI Compliance Management POC

Proof-of-concept for an automated Certificate of Insurance (COI) compliance management system. Validates the core loop: **Upload PDF > Extract fields via LLM vision > Score compliance > Remind > Export audit**.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 15 (App Router) + TypeScript | SSR, API routes, deployment target |
| UI | Tailwind CSS + shadcn/ui | Component library (Button, Table, Badge, Card, Select, Input, Dialog, Sonner) |
| Database | Supabase PostgreSQL | Vendors, documents, extractions, compliance status, reminders, templates |
| Storage | Supabase Storage (`coi-docs-dev` bucket) | PDF uploads + audit export ZIPs |
| LLM Extraction | OpenAI GPT-4o (vision) | PDF page image analysis, structured JSON extraction |
| PDF Rendering | `pdf-to-img` (pdfjs-based, pure JS) | Convert PDF pages to PNG for LLM vision input |
| Export | `archiver` | Server-side ZIP generation for audit bundles |
| Date Logic | `date-fns` | Expiry calculations, reminder stage math |
| Hosting | Vercel (target) | Serverless deployment with Node.js runtime |

---

## Architecture

```
Browser (Next.js App Router)
  |
  |-- /upload page ---------> POST /api/upload (PDF + vendor_id)
  |                               |-> SHA-256 checksum + dedup check
  |                               |-> Upload PDF to Supabase Storage
  |                               |-> Insert cw_documents row
  |                               |-> Return document_id
  |
  |                           POST /api/extract (document_id)
  |                               |-> Download PDF from Supabase Storage
  |                               |-> pdf-to-img: PDF buffer -> PNG base64[]
  |                               |-> GPT-4o Vision: PNG[] -> structured JSON
  |                               |-> Insert cw_coi_extractions row
  |                               |-> Diff vs previous extraction (regression check)
  |                               |-> Score compliance vs trade template
  |                               |-> Upsert cw_compliance_status
  |                               |-> Return extraction + compliance + diff
  |
  |-- /dashboard page ------> GET /api/compliance (all vendors + status)
  |                           POST /api/reminders (run reminder engine)
  |                           POST /api/export (generate CSV + ZIP)
```

---

## Data Model

All tables prefixed with `cw_` to coexist safely with other tables in a shared Supabase project.

### cw_vendors
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | Auto-generated |
| name | TEXT | Vendor company name |
| email | TEXT | Contact email |
| trade_type | cw_trade_type ENUM | `GC` \| `HVAC` \| `CLEANING` |
| created_at | TIMESTAMPTZ | |

### cw_documents
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| vendor_id | UUID (FK -> cw_vendors) | |
| file_url | TEXT | Path in Supabase Storage |
| checksum | TEXT | SHA-256 of PDF bytes (dedup) |
| received_at | TIMESTAMPTZ | |
| source | TEXT | Always `'upload'` for POC |
| created_at | TIMESTAMPTZ | |

### cw_coi_extractions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| document_id | UUID (FK -> cw_documents) | |
| extracted_json | JSONB | Full extraction output (see schema below) |
| confidence | FLOAT | 0.0 - 1.0, from LLM self-report |
| needs_review | BOOLEAN | True if missing expiry, low confidence, or regression |
| extracted_at | TIMESTAMPTZ | |

### cw_compliance_status
| Column | Type | Notes |
|--------|------|-------|
| vendor_id | UUID (PK, FK -> cw_vendors) | One row per vendor |
| status | cw_compliance_status_enum | `green` \| `yellow` \| `red` |
| reasons_json | JSONB | Array of human-readable failure reasons |
| next_expiry_date | DATE | |
| last_checked_at | TIMESTAMPTZ | |

### cw_reminder_log
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | |
| vendor_id | UUID (FK -> cw_vendors) | |
| stage | cw_reminder_stage ENUM | `30d` \| `14d` \| `7d` \| `1d` \| `expired_weekly` |
| message_preview | TEXT | Generated reminder text |
| sent_at | TIMESTAMPTZ | |

### cw_requirements_templates
| Column | Type | Notes |
|--------|------|-------|
| trade_type | cw_trade_type (PK) | One row per trade |
| rules_json | JSONB | Compliance rule definition |

---

## Extraction Schema (GPT-4o Output)

The LLM is prompted to return this exact JSON structure from each COI page image:

```json
{
  "policy_expiration_date": "YYYY-MM-DD or null",
  "general_liability_each_occurrence": 1000000,
  "general_liability_aggregate": 2000000,
  "workers_comp_present": true,
  "additional_insured_phrase_present": true,
  "waiver_of_subrogation_phrase_present": true,
  "insurer_name": "Zurich Insurance",
  "policy_number": "GL-001-123456",
  "named_insured": "Acme Construction LLC",
  "policy_effective_date": "YYYY-MM-DD or null",
  "confidence_score": 0.92,
  "raw_text_notes": "Clean digital PDF, all fields clearly readable"
}
```

### Fields by priority

| Field | Priority | Scoring impact |
|-------|----------|---------------|
| policy_expiration_date | REQUIRED | Red if missing, Yellow if <= 30d, Red if expired |
| general_liability_each_occurrence | Attempt | Red if < template minimum |
| general_liability_aggregate | Attempt | Red if < template minimum |
| workers_comp_present | Attempt | Red if required by template and missing |
| additional_insured_phrase_present | Attempt | Red if required by template and missing |
| waiver_of_subrogation_phrase_present | Attempt | Red if required by template and missing |
| confidence_score | Auto | needs_review = true if < 0.7 |

---

## Compliance Rules

Three trade templates, applied based on vendor's `trade_type`:

| Rule | GC | HVAC | CLEANING |
|------|-----|------|----------|
| GL Each Occurrence minimum | $1,000,000 | $1,000,000 | $1,000,000 |
| GL Aggregate minimum | $2,000,000 | $2,000,000 | $2,000,000 |
| Workers Comp required | Yes | Yes | Yes |
| Additional Insured required | Yes | Yes | **No** |
| Waiver of Subrogation required | Yes | Yes | **No** |
| Yellow threshold | 30 days before expiry | 30 days | 30 days |
| Red threshold | Expired | Expired | Expired |

### Status logic (deterministic, pure function)

```
RED if:
  - Missing expiration date
  - Policy expired
  - GL each occurrence below minimum
  - GL aggregate below minimum
  - Workers comp missing (when required)
  - Additional insured missing (when required)
  - Waiver of subrogation missing (when required)

YELLOW if:
  - No red conditions AND expiry <= 30 days away

GREEN if:
  - No red or yellow conditions
```

Red takes precedence over yellow. All failure reasons are collected and stored.

---

## Deterministic Diff Logic

When a vendor uploads a new COI, the system compares against the most recent previous extraction for that vendor:

| Check | Regression condition |
|-------|---------------------|
| GL Each Occurrence | Current < Previous |
| GL Aggregate | Current < Previous |
| Workers Comp | Was true, now false |
| Additional Insured | Was true, now false |
| Waiver of Subrogation | Was true, now false |

Any regression sets `needs_review = true` and appends regression reasons to the extraction notes.

**Expiry increase with unchanged limits is OK** (normal renewal).

---

## Reminder Engine

Triggered manually via "Run Reminders" button on the dashboard. No cron, no emails for POC.

### Stages

| Stage | Trigger |
|-------|---------|
| 30d | Expiry <= 30 days away |
| 14d | Expiry <= 14 days away |
| 7d | Expiry <= 7 days away |
| 1d | Expiry <= 1 day away |
| expired_weekly | Already expired (repeats weekly) |

### Deduplication

- For `30d`, `14d`, `7d`, `1d`: only sent once per vendor per stage (checked against `cw_reminder_log`)
- For `expired_weekly`: only sent if no `expired_weekly` reminder for that vendor in the past 7 days

### Output

Each reminder generates a `message_preview` like:
```
REMINDER: COI for Acme Construction (GC) expires in 7 days (2026-02-25).
Please request an updated certificate. Issues: GL below minimum; Missing waiver.
```

---

## Audit Export

Generates a downloadable ZIP containing:

```
audit_1740000000.zip
  |- index.csv        (vendor_name, trade_type, status, expiry, limits, flags, issues)
  |- coi/
      |- Acme_Construction_coi.pdf
      |- BuildRight_Inc_coi.pdf
      |- ...
```

- Uploaded to Supabase Storage at `coi-docs-dev/exports/`
- Returns a signed download URL (1-hour expiry)

---

## API Routes

| Method | Endpoint | Purpose | Timeout |
|--------|----------|---------|---------|
| GET | `/api/vendors` | List all vendors for dropdown | Default |
| POST | `/api/upload` | Upload PDF, checksum dedup, store in Supabase | Default |
| POST | `/api/extract` | Full pipeline: PDF->images->GPT-4o->extraction->scoring->diff | 60s |
| GET | `/api/compliance` | Dashboard data: all vendors + status + latest upload | Default |
| POST | `/api/compliance/score` | Re-score existing extraction (no re-extract) | Default |
| POST | `/api/reminders` | Run reminder engine, log results | Default |
| POST | `/api/export` | Generate CSV + ZIP, return signed download URL | 60s |

---

## UI Pages

### Page 1: Upload (`/upload`)

- Vendor select dropdown (populated from `cw_vendors`)
- PDF file picker with 4MB size validation
- Progressive status: "Uploading..." > "Extracting & Scoring..." > Results
- Duplicate detection (same vendor + same file checksum = skip)
- Results display:
  - Compliance badge (GREEN / YELLOW / RED)
  - Failure reasons list
  - Regression warnings (if previous extraction exists)
  - All extracted fields with values
  - Confidence percentage
  - Raw notes from LLM

### Page 2: Dashboard (`/dashboard`)

- Summary cards: compliant count, expiring soon count, non-compliant count
- Vendor table: name, trade, expiry date, status badge, missing/issues, last upload date
- "Run Reminders" button with results dialog
- "Export Audit" button with download link
- Refresh button

---

## PDF-to-Image Pipeline

```
PDF Buffer (from Supabase Storage)
  |
  |-- pdf-to-img (scale: 2.0, ~144 DPI)
  |     Uses pdfjs-dist internally, pure JS, no native deps
  |     Returns async iterator of PNG Buffers
  |
  |-- Base64 encode each page
  |
  |-- Send first 2 pages to GPT-4o as image_url content parts
  |     (ACORD 25 certificates are typically 1 page)
  |
  |-- Parse JSON response, strip markdown fences if present
  |
  |-- Validate confidence_score, set needs_review flags
```

### Known issue

`pdf-to-img` uses `pdfjs-dist` which has worker resolution issues with Next.js Turbopack. Fixed via `serverExternalPackages: ['pdf-to-img']` in `next.config.ts` to prevent bundling.

---

## Synthetic Test Data

18 ACORD-style COI PDFs generated via `jspdf` in `scripts/generate-synthetic-cois.ts`:

| # | Filename | Scenario | Expected Status |
|---|----------|----------|----------------|
| 1 | 01_compliant_gc | Fully compliant GC, all fields present | GREEN |
| 2 | 02_compliant_hvac | Fully compliant HVAC | GREEN |
| 3 | 03_compliant_cleaning | Compliant cleaning (no AI/waiver needed) | GREEN |
| 4 | 04_low_gl_limits | GL $500K/$1M (below $1M/$2M minimum) | RED |
| 5 | 05_missing_wc | No workers compensation section | RED |
| 6 | 06_missing_additional_insured | No additional insured language | RED (GC/HVAC), GREEN (cleaning) |
| 7 | 07_missing_waiver | No waiver of subrogation language | RED (GC/HVAC), GREEN (cleaning) |
| 8 | 08_expired_30d | Expired ~30 days ago | RED |
| 9 | 09_expires_tomorrow | Expires next day | YELLOW |
| 10 | 10_expires_7d | Expires in ~7 days | YELLOW |
| 11 | 11_expires_14d | Expires in ~14 days, high limits ($2M/$4M) | YELLOW |
| 12 | 12_expires_30d | Expires in ~30 days | YELLOW |
| 13 | 13_missing_expiry | No expiration date on cert | RED + needs_review |
| 14 | 14_low_confidence | Simulated blurry/faded text | Likely needs_review |
| 15 | 15_multi_policy | GL + Auto + WC on one cert | GREEN (tests multi-section parsing) |
| 16 | 16_regression_lower_limits | Same insured as #1 but $500K/$1M | RED + regression flag |
| 17 | 17_all_missing | Nearly all fields blank | RED + needs_review |
| 18 | 18_high_limits | $5M/$10M limits, expires 2027 | GREEN |

Generate with: `npx tsx scripts/generate-synthetic-cois.ts`
Output: `test-cois/` directory

---

## Project Structure

```
src/
  app/
    page.tsx                         # Redirects to /upload
    layout.tsx                       # Nav bar + Toaster
    upload/page.tsx                  # Page 1: Upload COI
    dashboard/page.tsx               # Page 2: Compliance dashboard
    api/
      vendors/route.ts               # GET vendors list
      upload/route.ts                # POST upload PDF
      extract/route.ts               # POST full extraction pipeline
      compliance/route.ts            # GET all vendor compliance
      compliance/score/route.ts      # POST re-score extraction
      reminders/route.ts             # POST run reminders
      export/route.ts                # POST generate audit ZIP
  lib/
    supabase/
      server.ts                      # Service role client (server-side only)
      client.ts                      # Anon key client (browser-side)
    claude/
      client.ts                      # OpenAI SDK singleton
      extract-coi.ts                 # Extraction prompt + JSON parsing
    compliance/
      scorer.ts                      # Pure function: extraction + rules -> score
      diff.ts                        # Compare current vs previous extraction
      templates.ts                   # Hardcoded rule definitions (mirrors DB)
    reminders/
      engine.ts                      # Stage computation + message generation
    pdf/
      to-images.ts                   # PDF buffer -> base64 PNG array
    export/
      generate.ts                    # CSV generation + ZIP assembly
    types/
      database.ts                    # All TypeScript interfaces
    utils.ts                         # shadcn cn() helper
  components/
    ui/                              # shadcn/ui components
    upload/
      upload-form.tsx                # Vendor select + file input + progress
      extraction-result.tsx          # Extracted fields + compliance badge
    dashboard/
      vendor-table.tsx               # Main compliance data table
      status-badge.tsx               # GREEN/YELLOW/RED badge
      reminder-button.tsx            # Run reminders + results dialog
      export-button.tsx              # Export audit + download link

supabase/
  migrations/
    000_all_in_one.sql               # Combined migration + seed (for SQL Editor)
    001-007_*.sql                    # Individual migration files
  seed/
    seed.sql                         # 10 vendors + 3 templates

scripts/
  generate-synthetic-cois.ts         # Generates 18 test PDFs

test-cois/                           # Generated synthetic COI PDFs
```

---

## Setup

### Prerequisites
- Node.js 18+
- Supabase project (existing or new)
- OpenAI API key with GPT-4o access

### Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment** — copy `.env.example` to `.env.local` and fill in:
   ```
   SUPABASE_URL_DEV=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY_DEV=eyJ...  (Settings > API > service_role secret)
   NEXT_PUBLIC_SUPABASE_URL_DEV=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY_DEV=eyJ...  (Settings > API > anon public)
   OPENAI_API_KEY=sk-...
   ```

3. **Create database tables** — run `supabase/migrations/000_all_in_one.sql` in Supabase SQL Editor

4. **Create storage bucket** — in Supabase Dashboard > Storage, create a **private** bucket named `coi-docs-dev`

5. **Generate test PDFs**
   ```bash
   npx tsx scripts/generate-synthetic-cois.ts
   ```

6. **Start dev server**
   ```bash
   npm run dev
   ```

7. Open http://localhost:3000

---

## Success Criteria

The POC is successful if:

- [ ] Uploading a COI produces extracted expiry, compliance score, and R/Y/G status
- [ ] Compliance scoring correctly applies trade-specific rules
- [ ] Regression detection flags limit decreases on re-upload
- [ ] Reminder logic executes and logs appropriate stages
- [ ] Audit ZIP downloads correctly with CSV + all PDFs
- [ ] At least 15 of 18 synthetic COIs process without crashing
- [ ] If expiry extraction is unreliable, that is documented as the first thing to fix

---

## Known Limitations & Risks

| Area | Limitation | Mitigation |
|------|-----------|------------|
| Extraction accuracy | Synthetic PDFs have clean digital text; real COIs are often scanned/skewed | confidence_score + needs_review flags; test with real COIs next |
| PDF-to-image quality | JS-based renderer (~144 DPI) vs native tools | Increase scale factor if LLM struggles; consider Textract for production |
| Vercel timeout | Extraction takes 5-15s; free tier has 10s limit | `maxDuration: 60` set; may need Pro plan |
| Vercel body limit | 4.5MB max request body | Client-side file size validation; direct-to-storage upload for large files |
| LLM JSON parsing | GPT-4o may wrap JSON in code fences | Fence-stripping parser with fallback |
| No authentication | All API routes are public | POC only; add auth before any real deployment |
| Single-tenant | No multi-tenant isolation | POC only; add org/tenant scoping for production |
| No real emails | Reminders logged only, not sent | Integrate SendGrid/Resend for production |

---

## Not Built (by design)

- Gmail connector / email ingestion
- Portal scraping
- Broker integrations
- SSO / authentication
- Full endorsement OCR
- Property-level mapping
- Payment system integration
- Multi-tenant hardening
- Cron-based reminder scheduling

This is **proof-of-core-loop only**.

---

## Next Steps (if POC validates)

1. **Test with real COIs** — the #1 priority; synthetic accuracy doesn't predict real-world accuracy
2. **Improve extraction prompt** — tune based on where GPT-4o fails on real documents
3. **Add OCR fallback** — for scanned/image-only PDFs where pdfjs rendering is poor
4. **Authentication** — Supabase Auth or Clerk before any deployment
5. **Cron reminders** — Vercel Cron or Supabase pg_cron for automated scheduling
6. **Email integration** — SendGrid/Resend for actual vendor notifications
7. **Admin UI for templates** — edit compliance rules without code changes
8. **Property-level scoping** — associate COIs with specific properties/projects
9. **Broker/portal ingestion** — automated COI collection beyond manual upload
