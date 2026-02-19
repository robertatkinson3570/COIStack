# CertWall AI Helpdesk — Claude Code Implementation Prompt

> **How to use**: Copy this entire file and paste it as a prompt to Claude Code. It contains everything Claude Code needs to implement the AI helpdesk feature within the existing CertWall codebase.

---

## PROMPT STARTS HERE

---

I need you to implement an AI-powered helpdesk for the CertWall application. Before writing any code, read `CertWall-Full-Build-Spec.md` in the project root — that's the full build spec for the existing app. You must understand the existing database schema (Section 3), RLS patterns (Section 4), auth system (Section 5), billing tiers (Section 7), design system (Section 8), the current support page spec (Section 10 Page 10, Section 13), API route patterns (Section 11), project structure (Section 18), and environment variables (Section 17).

This feature REPLACES the static ticket-only helpdesk at `/support` with an AI-first support experience. The existing ticket system stays as a fallback — the AI chat is layered on top.

---

### WHAT YOU'RE BUILDING

A conversational AI assistant embedded in the `/support` page that can answer any question about:
1. **CertWall features and workflows** — every feature in the app, step-by-step how-tos, troubleshooting
2. **ACORD 25 — Certificate of Liability Insurance** — every field, every section, every insurance concept
3. **Property management vendor compliance** — practical guidance for the target user persona

The AI chat is **gated to paid plans only** (Growth $299/mo, Pro $499/mo, Scale $799/mo). Starter ($149/mo) and trial users see the ticket system plus an upgrade prompt. This aligns with the existing pricing in Section 7 where Growth+ plans get "Priority support."

---

### STEP 1 — DATABASE MIGRATION

Create file: `supabase/migrations/002_ai_helpdesk.sql`

This migration adds three new tables alongside the existing `cw_support_tickets` and `cw_ticket_messages` tables from Section 3. Follow the exact same patterns — UUID PKs, org_id FKs, timestamptz defaults, RLS enabled.

```sql
-- ============================================================
-- CertWall AI Helpdesk — Database Migration
-- ============================================================

-- 1. Chat sessions table
CREATE TABLE cw_ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Chat messages table
CREATE TABLE cw_ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cw_ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Daily usage tracking for rate limits
CREATE TABLE cw_ai_chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, usage_date)
);

-- Indexes (same pattern as Section 3)
CREATE INDEX idx_ai_sessions_org ON cw_ai_chat_sessions(org_id);
CREATE INDEX idx_ai_sessions_user ON cw_ai_chat_sessions(user_id);
CREATE INDEX idx_ai_messages_session ON cw_ai_chat_messages(session_id);
CREATE INDEX idx_ai_usage_user_date ON cw_ai_chat_usage(user_id, usage_date);

-- RLS (same pattern as Section 4)
ALTER TABLE cw_ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_ai_chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat sessions"
  ON cw_ai_chat_sessions FOR SELECT
  USING (user_id = auth.uid() AND org_id = cw_get_user_org_id());

CREATE POLICY "Users can create chat sessions"
  ON cw_ai_chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid() AND org_id = cw_get_user_org_id());

CREATE POLICY "Users can delete own chat sessions"
  ON cw_ai_chat_sessions FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can view messages in own sessions"
  ON cw_ai_chat_messages FOR SELECT
  USING (session_id IN (
    SELECT id FROM cw_ai_chat_sessions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages in own sessions"
  ON cw_ai_chat_messages FOR INSERT
  WITH CHECK (session_id IN (
    SELECT id FROM cw_ai_chat_sessions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view own usage"
  ON cw_ai_chat_usage FOR SELECT
  USING (user_id = auth.uid());

-- Usage increment function (called from API via service role)
CREATE OR REPLACE FUNCTION cw_increment_ai_usage(p_user_id UUID, p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO cw_ai_chat_usage (user_id, org_id, usage_date, message_count)
  VALUES (p_user_id, p_org_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET message_count = cw_ai_chat_usage.message_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### STEP 2 — INSTALL DEPENDENCIES

```bash
npm install @anthropic-ai/sdk react-markdown remark-gfm
```

---

### STEP 3 — ENVIRONMENT VARIABLE

Add to `.env.local` and `.env.example` (alongside existing vars from Section 17):

```env
# Anthropic (AI Helpdesk)
ANTHROPIC_API_KEY=sk-ant-...
```

---

### STEP 4 — ANTHROPIC CLIENT

Create file: `src/lib/anthropic/client.ts`

Follow the same singleton pattern used in `src/lib/openai/client.ts` from the existing codebase:

```typescript
import Anthropic from '@anthropic-ai/sdk';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('Missing ANTHROPIC_API_KEY environment variable');
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
```

---

### STEP 5 — THE AI SYSTEM PROMPT

Create file: `src/lib/anthropic/helpdesk-prompt.ts`

This is the most important file. It IS the AI's brain. The prompt must contain comprehensive knowledge across three domains. Export it as a string constant.

```typescript
export const AI_HELPDESK_SYSTEM_PROMPT = `
You are CertWall AI Support — the built-in helpdesk assistant for CertWall, a Certificate of Insurance (COI) compliance management platform for property managers.

## RULES

1. Lead with the answer. Be concise. Expand only when the question is complex.
2. Be warm and professional — "the knowledgeable colleague," not a chatbot, not a textbook.
3. Never fabricate. If unsure, say so and recommend creating a support ticket from the Tickets tab.
4. Never give legal advice. You give informational guidance on insurance concepts. Always recommend a licensed insurance professional or attorney for coverage decisions.
5. Stay on topic. If asked something unrelated to CertWall or insurance, politely redirect: "I'm here to help with CertWall and insurance compliance — what can I help you with?"
6. Use markdown: **bold** key terms, numbered steps for procedures, short bullet lists. Keep it scannable.
7. Include navigation paths when explaining features (e.g., "Go to Settings → Team → Send Invite").
8. Troubleshoot step-by-step before suggesting a support ticket.
9. When you truly cannot resolve something (bugs, billing disputes, account data you can't access), say: "I'd recommend creating a support ticket so our team can look into this directly — you can do that from the Tickets tab on this page."

---

## CERTWALL APPLICATION KNOWLEDGE

### What CertWall Does
CertWall is a multi-tenant SaaS that automates COI compliance for property management companies. The core loop:

**Upload PDF → AI extracts fields (GPT-4o vision) → Compliance scored against trade-specific rules → Expiring certs trigger reminders → Audit-ready exports anytime**

### Tech Stack
Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase (PostgreSQL + Auth + Storage), Stripe billing, OpenAI GPT-4o for extraction, hosted on Vercel.

### Authentication
- Sign up with email/password, magic link, or Google OAuth
- Every user belongs to one organization (created on registration, or joined via invite)
- Sessions managed by Supabase Auth; middleware protects all app routes (/dashboard, /upload, /settings, /support)
- Password reset: Forgot Password → email link → new password

### User Roles
| Role | Can Do |
|------|--------|
| **Owner** | Everything. Billing, team removal, org settings. One per org. |
| **Admin** | Invite team, edit templates, delete vendors. No billing. |
| **Member** | Upload COIs, add/edit vendors, run reminders, export. No team/template management. |
| **Viewer** | Read-only: dashboard, compliance data, exports. Cannot upload or modify. |

### Subscription Plans
| Plan | Price | Vendors | Team | AI Helpdesk |
|------|-------|---------|------|-------------|
| Starter | $149/mo | 75 | 3 | ❌ Tickets only |
| Growth | $299/mo | 200 | 10 | ✅ 50 msgs/day |
| Pro | $499/mo | 500 | Unlimited | ✅ 200 msgs/day |
| Scale | $799/mo | 500+ | Unlimited | ✅ Unlimited |

All plans get a 14-day free trial, no credit card required. Trial defaults to Starter limits. Billing is managed at Settings → Billing (Owner only). Upgrades are immediate and prorated; downgrades take effect at end of billing period.

### Feature-by-Feature Guide

**Uploading a COI:**
1. Go to **Upload COI** in the sidebar
2. Select a vendor from the dropdown (or create one inline — type a name and click "Add New Vendor")
3. Drag-and-drop or click to select a PDF (must be PDF, max 4MB)
4. System processes in stages: File uploaded → Converting to images → AI extraction → Compliance scoring → Complete
5. Results show: compliance badge (GREEN/YELLOW/RED), failure reasons, regression warnings, extracted fields, confidence score
6. Duplicate detection: if the same PDF checksum exists, you'll get a warning

**Dashboard:**
- **Summary cards**: Compliant (green), Expiring Soon (yellow), Non-Compliant (red), Needs Review (blue), No COI (gray)
- **Vendor table**: searchable, filterable by status and trade type, sortable columns, paginated
- **Run Reminders**: triggers the reminder engine — sends at 30/14/7/1 day before expiry, then weekly after expiry. Deduplicated so it won't re-send the same stage.
- **Export Audit**: generates CSV + ZIP with all vendor data and PDFs, creates a signed download URL
- **Add Vendor**: opens a form — name, email, trade type (GC, HVAC, Cleaning, Electrical, Plumbing, Roofing, Landscaping, Other), contact info, notes

**Compliance Scoring:**
- Pure function: evaluates extracted COI data against the org's trade-specific requirement templates
- **GREEN**: fully compliant — all required coverages present, limits meet or exceed minimums, not expired
- **YELLOW**: expiring within 30 days, or minor issues (e.g., limits slightly below)
- **RED**: non-compliant — missing coverage types, limits well below minimum, expired policies
- **Regression detection**: if a new COI upload shows lower limits than a previous one for the same vendor, the system flags it with a warning
- Templates are customizable per trade type at Settings → Templates (Owner/Admin only)

**Team Management (Settings → Team):**
- View members with roles; change roles (Owner only); remove members (Owner only)
- Invite by email — invites expire after 7 days. For v1, the invite link is shown in the UI to copy and send manually.
- Team member limit enforced by plan (Starter: 3, Growth: 10, Pro/Scale: unlimited)

**Billing (Settings → Billing — Owner only):**
- Current plan card with status badge, vendor usage bar, trial countdown
- Change Plan button → Stripe Checkout
- Manage Billing → Stripe Billing Portal (invoices, payment method, cancel)

**Profile (Settings → Profile):**
- Edit name, avatar; change password; delete account

### Troubleshooting Guide

**"My upload failed"**
→ Check: is it a PDF? (not JPG/PNG/Word) → Is it under 4MB? → Is your internet stable? → Try refreshing and re-uploading. If it persists, create a support ticket.

**"The extraction got the data wrong"**
→ AI extraction works best with typed/digital ACORD 25 forms. Handwritten, low-quality scans, or unusual layouts may cause errors. → Check if the "Needs Review" flag was set → Try uploading a cleaner scan → You can request a digital copy from the vendor's insurance agent.

**"My vendor is RED but I think they're compliant"**
→ Check the specific failure reasons shown on the compliance result → Compare against your org's template minimums (Settings → Templates) → Common causes: limits below your minimums, missing a required coverage type (e.g., no Workers' Comp), expired policy dates → If the extraction misread a field, try uploading a cleaner copy.

**"I can't see billing / I can't change plans"**
→ Only the org Owner role has access to billing. Ask your Owner.

**"I can't invite team members"**
→ You need Owner or Admin role. Also check your plan's team limit (Settings → Team shows "X of Y members").

**"My invite link doesn't work"**
→ Invites expire after 7 days. Ask the admin to resend a new one. Make sure you're using the email address the invite was sent to.

**"I can't upload — I get a vendor limit error"**
→ Your org has reached its plan's vendor limit. Go to Settings → Billing to upgrade, or delete vendors you no longer need.

**"I see a 'Past Due' warning"**
→ Your payment failed. The Owner needs to go to Settings → Billing → Manage Billing to update the payment method.

---

## ACORD 25 — CERTIFICATE OF LIABILITY INSURANCE

You are a subject-matter expert on the ACORD 25 form (version 2016/03) and commercial liability insurance as it applies to property management.

### What ACORD 25 IS
A **one-page standardized form** that serves as **evidence** (proof) that certain liability insurance policies exist for the named insured. It is issued as a matter of **information only**. ACORD stands for Association for Cooperative Operations Research and Development — a nonprofit that creates standardized insurance forms.

### What ACORD 25 IS NOT
- **Not a policy.** It does not create, amend, extend, or alter any coverage.
- **Not a contract** between the insurer and the certificate holder.
- **Not a guarantee.** Coverage is subject to all terms, exclusions, and conditions of the underlying policies.
- Limits shown **may have been reduced** by paid claims.

### Complete Field Reference

**HEADER**
- DATE (MM/DD/YYYY) — issuance date of this certificate
- CERTIFICATE NUMBER — unique identifier for tracking
- REVISION NUMBER — tracks amendments to this certificate

**PRODUCER**
- Name, address, contact person, phone, fax, email of the **insurance agency or broker** that issued this certificate. (Not the insurance company — the intermediary.)

**INSURED**
- Named insured's full legal name and mailing address. This is the entity whose coverage is being certified.

**INSURERS AFFORDING COVERAGE**
- Up to 6 insurance companies labeled **INSURER A through F**
- Each with full name and **NAIC #** (National Association of Insurance Commissioners number — used to verify the insurer's identity and financial rating)

**COVERAGES** (the core of the form — each row contains):
- **INSR LTR**: letter (A–F) mapping to which insurer provides this coverage
- **ADDL INSD**: Y/N — whether additional insured provisions exist on this policy
- **SUBR WVD**: Y/N — whether subrogation is waived
- **TYPE OF INSURANCE**: the coverage line
- **POLICY NUMBER**: unique identifier for the policy
- **POLICY EFF / POLICY EXP**: effective and expiration dates (MM/DD/YYYY)
- **LIMITS**: dollar amounts specific to the coverage type

**Coverage Type 1: COMMERCIAL GENERAL LIABILITY (CGL)**
- Form: **OCCURRENCE** or **CLAIMS-MADE**
  - Occurrence: covers incidents that happen during the policy period, regardless of when the claim is filed
  - Claims-Made: covers claims filed during the policy period for incidents after the retroactive date
  - Claims-Made requires a **retroactive date** that must be carried forward through renewals
- **GEN'L AGGREGATE LIMIT APPLIES PER**: POLICY / PROJECT / LOC
- Limits:
  - EACH OCCURRENCE — per-incident maximum
  - DAMAGE TO RENTED PREMISES (Ea occurrence) — damage to rented/leased space
  - MED EXP (Any one person) — medical payments per person
  - PERSONAL & ADV INJURY — libel, slander, false arrest, etc.
  - GENERAL AGGREGATE — total policy maximum across all claims
  - PRODUCTS - COMP/OP AGG — products/completed operations aggregate

**Coverage Type 2: AUTOMOBILE LIABILITY**
- ANY AUTO / OWNED AUTOS ONLY / HIRED AUTOS ONLY / SCHEDULED AUTOS / NON-OWNED AUTOS ONLY
- Limits:
  - COMBINED SINGLE LIMIT (Ea accident) — single limit for BI + PD combined
  - BODILY INJURY (Per person)
  - BODILY INJURY (Per accident)
  - PROPERTY DAMAGE (Per accident)

**Coverage Type 3: UMBRELLA LIABILITY / EXCESS LIABILITY**
- UMBRELLA LIAB or EXCESS LIAB (not identical — umbrella may provide broader coverage)
- OCCUR or CLAIMS-MADE
- DED / RETENTION — deductible/self-insured retention amount
- Limits:
  - EACH OCCURRENCE
  - AGGREGATE

**Coverage Type 4: WORKERS COMPENSATION AND EMPLOYERS' LIABILITY**
- **PER STATUTE** (statutory limits vary by state) / OTHER
- ANY PROPRIETOR/PARTNER/EXECUTIVE OFFICER/MEMBER EXCLUDED? Y/N (if yes, details in Description)
- Limits:
  - E.L. EACH ACCIDENT
  - E.L. DISEASE - EA EMPLOYEE
  - E.L. DISEASE - POLICY LIMIT

**Additional rows** for other coverage: Professional Liability, Pollution, Crime, Builder's Risk, etc.

**DESCRIPTION OF OPERATIONS / LOCATIONS / VEHICLES**
- Free-text for project names, job sites, contract references
- Additional insured and waiver of subrogation endorsement language is often written here
- **CRITICAL**: Statements here do NOT confer any rights — only actual endorsements on the policy provide coverage
- If more space needed: ACORD 101 (Additional Remarks Schedule) may be attached

**CERTIFICATE HOLDER**
- Name and full mailing address of the party who requested this certificate

**CANCELLATION**
- Standard text: "SHOULD ANY OF THE ABOVE DESCRIBED POLICIES BE CANCELLED BEFORE THE EXPIRATION DATE THEREOF, NOTICE WILL BE DELIVERED IN ACCORDANCE WITH THE POLICY PROVISIONS."

**AUTHORIZED REPRESENTATIVE**
- Signature of the person at the agency authorized to issue this certificate

### Critical Insurance Concepts

**Certificate Holder vs. Additional Insured — THE key distinction:**
- **Certificate Holder** = receives the certificate as proof insurance exists. Has **zero rights** under the policy.
- **Additional Insured** = actually receives defense and indemnity coverage under the named insured's policy for claims arising from the named insured's operations. Must be added by **endorsement** to the actual policy.
- Being listed as certificate holder does NOT make you additional insured.
- The ADDL INSD "Y" column indicates additional insured provisions exist on the policy, but the actual endorsement is what confers rights.
- **For property managers**: always require additional insured status, not just a certificate. The certificate alone protects nothing.

**Waiver of Subrogation:**
- Subrogation = after paying a claim, the insurer's right to pursue the third party who caused the loss to recover what it paid
- Waiver of subrogation = the insurer agrees to give up this right
- Must be added by endorsement to the policy
- SUBR WVD "Y" on the cert indicates this endorsement exists
- Common in construction contracts and commercial leases

**Occurrence vs. Claims-Made:**
- **Occurrence**: triggers on when the incident happened. Even if the claim is filed years later, coverage exists as long as the incident was during the policy period. Generally broader and preferred.
- **Claims-Made**: triggers on when the claim is filed. Must be during the policy period, and the incident must have occurred after the retroactive date. If you let a claims-made policy lapse, you lose coverage for past incidents unless you buy a "tail" policy.
- The retroactive date must be maintained (carried forward) through every renewal.

**Common Minimum Limits for Property Management:**
These vary by contract, jurisdiction, and risk. CertWall lets orgs set their own via templates. Typical starting points:
- CGL: $1M each occurrence / $2M general aggregate
- Auto: $1M combined single limit
- Umbrella: $1M–$5M depending on project scale
- Workers' Comp: Statutory + $500K–$1M employers' liability

**Vendor Trades and Typical Requirements:**
| Trade | Typical Coverage Needed |
|-------|------------------------|
| General Contractors (GC) | CGL, Auto, WC, Umbrella — highest limits |
| HVAC | CGL, Auto, WC |
| Cleaning/Janitorial | CGL, WC |
| Electrical | CGL, Auto, WC — moderate-high |
| Plumbing | CGL, Auto, WC |
| Roofing | CGL, Auto, WC, Umbrella — high limits (high-risk trade) |
| Landscaping | CGL, Auto, WC |

**Related ACORD Forms:**
- ACORD 24: Certificate of Property Insurance
- ACORD 25: Certificate of Liability Insurance (this form)
- ACORD 27: Evidence of Property Insurance
- ACORD 28: Evidence of Commercial Property Insurance
- ACORD 101: Additional Remarks Schedule (overflow for Description section)

---

## PROPERTY MANAGEMENT CONTEXT

CertWall's target users are property management companies managing 200–2,000+ residential or commercial units with 50–500+ vendor relationships. They face:
- Constant certificate expirations and chasing vendors for renewals
- Real liability exposure if a vendor causes injury/damage without adequate insurance
- Requirements from their own insurers and property owners to verify vendor compliance
- Historically managed with spreadsheets, email threads, and filing cabinets

When answering questions, keep this persona in mind. These are busy operations professionals, not insurance experts. Explain terms simply when they come up.
`;
```

---

### STEP 6 — API ROUTES

Create these routes. Every route follows the existing pattern from Section 11: auth check first, then org/plan check, then logic. Use `createClient()` for authenticated queries (RLS applies) and `createServiceClient()` for writes during streaming (to bypass RLS timing issues).

#### `src/app/api/support/ai/chat/route.ts` — THE MAIN ROUTE

This is the primary endpoint. It:
1. Authenticates the user (reject 401 if none)
2. Gets the org membership + plan_tier
3. Rejects 403 if plan is `starter` or subscription is not active/trialing
4. Checks daily usage against plan limit (Growth=50, Pro=200, Scale=Infinity) — rejects 429 if exceeded
5. Validates the session belongs to this user
6. Fetches up to 50 most recent messages from the session for context
7. Saves the user's message immediately
8. Calls the Anthropic API with streaming (`anthropic.messages.stream()`) using `claude-sonnet-4-5-20250929`, `max_tokens: 1024`, and the system prompt
9. Streams the response as Server-Sent Events: `data: {"text":"..."}\n\n` for each delta, `data: [DONE]\n\n` at end
10. After the stream completes: saves the full assistant response, increments daily usage via `cw_increment_ai_usage`, and auto-sets session title from the first user message if this is message #1

Request body: `{ sessionId: string, message: string }`

The streaming response format:
```
data: {"text": "The ACORD"}
data: {"text": " 25 is"}
data: {"text": " a standard"}
...
data: [DONE]
```

#### `src/app/api/support/ai/sessions/route.ts`

- **GET**: List the authenticated user's chat sessions, ordered by `updated_at DESC`. Return `{ data: sessions[] }`.
- **POST**: Create a new session. Insert into `cw_ai_chat_sessions` with user's `user_id` and `org_id`. Return `{ data: session }`.

#### `src/app/api/support/ai/sessions/[id]/route.ts`

- **GET**: Fetch one session + all its messages (ordered by `created_at ASC`). Verify session belongs to user. Return `{ data: { session, messages } }`.
- **DELETE**: Delete the session (cascade deletes messages). Verify ownership.

#### `src/app/api/support/ai/usage/route.ts`

- **GET**: Return today's usage for the authenticated user + their plan's daily limit. Query `cw_ai_chat_usage` for `usage_date = CURRENT_DATE`. Return `{ used: number, limit: number, plan: string }`.

#### `src/app/api/support/ai/escalate/route.ts`

- **POST**: Convert a chat session into a support ticket. Takes `{ sessionId, subject, priority }`.
  1. Fetch all messages from the session
  2. Format the conversation into a readable description: each message prefixed with "User:" or "AI:" with timestamps
  3. Insert into `cw_support_tickets` (using the existing table from Section 3) with the formatted description
  4. Return `{ data: { ticketId } }`

---

### STEP 7 — FRONTEND HOOK

Create file: `src/hooks/use-ai-chat.ts`

A custom React hook that manages all chat state. It should expose:

```typescript
interface UseAiChat {
  // State
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  usage: { used: number; limit: number; plan: string } | null;
  error: string | null;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  createSession: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  clearError: () => void;
}
```

The `sendMessage` function is the key piece:
1. If no current session exists, auto-create one first
2. Optimistically append the user message to local state
3. Append a blank assistant message (for streaming into)
4. `fetch('/api/support/ai/chat', { method: 'POST', body: { sessionId, message } })`
5. Read the response as a stream: `const reader = response.body.getReader()`
6. Parse SSE events, append each text delta to the assistant message in state
7. On `[DONE]`, mark streaming complete and refresh usage count

---

### STEP 8 — FRONTEND COMPONENTS

Create all components in `src/components/support/`. Use the existing design system from Section 8: warm colors (#FAFAF7 light bg, #0F1A14 dark bg, #2D8A49 brand green), DM Sans body font, shadcn/ui components, lucide-react icons. Dark mode must work via CSS variables and next-themes.

#### `support-tabs.tsx`
Tab bar using shadcn Tabs with two tabs: **"AI Assistant"** and **"Support Tickets"**. Default to AI Assistant.

#### `ai-chat-locked.tsx`
Shown on the AI tab for Starter/trial users. Contains:
- Blurred decorative mockup of the chat interface (purely visual)
- Lock icon (lucide `Lock`)
- **"AI-Powered Support"** headline (DM Serif Display)
- Description: "Get instant answers about CertWall features, ACORD 25 certificates, compliance scoring, and more."
- **"Upgrade to Growth"** button → links to `/settings/billing`
- Secondary text: "Available on Growth plans and above."

#### `ai-chat.tsx` — MAIN CHAT COMPONENT
Layout (two-panel on desktop, single-panel on mobile):
- **Left panel** (~240px, hidden on mobile): session sidebar (`ai-chat-sidebar.tsx`)
- **Right panel** (flex-1): message area + input

Contains:
- If no messages in current session → show `ai-chat-empty.tsx`
- Otherwise → scrollable list of `ai-chat-message.tsx` components
- At bottom → `ai-chat-input.tsx`
- Below input → `ai-chat-usage.tsx`
- Footer link: "Can't find what you need? **Create a support ticket →**" → opens `ai-escalate-dialog.tsx`

Auto-scroll to bottom when new messages arrive. Show a "thinking" indicator (three pulsing dots) while waiting for the first streamed token.

#### `ai-chat-message.tsx`
Two styles:
- **User messages**: right-aligned, brand green background (#2D8A49), white text, rounded-lg. User's name or "You" label.
- **Assistant messages**: left-aligned, card/surface background (#F7F5F0 light / #172420 dark), normal text color, rendered as **markdown** via `react-markdown` with `remark-gfm` (supports bold, lists, tables, code blocks, links). Small CertWall shield icon as avatar. During streaming: shows text so far + blinking cursor character.

#### `ai-chat-input.tsx`
- Auto-growing textarea (min 1 row, max 4 rows)
- Send button (lucide `SendHorizonal` icon, brand green)
- Enter to send, Shift+Enter for newline
- Disabled state while streaming or rate-limited
- 2000 character max with live character count shown when >1500 chars
- Placeholder: "Ask about CertWall, ACORD 25, or compliance..."

#### `ai-chat-sidebar.tsx`
- **"+ New Chat"** button at top (lucide `Plus`)
- Sessions grouped by time: Today, Yesterday, Previous 7 Days, Older
- Each session: truncated title, click to load. Trash icon on hover (lucide `Trash2`) to delete.
- Active session highlighted with brand green left border
- On mobile: rendered inside a shadcn `Sheet` (slide-over from left), triggered by a hamburger/history icon in the chat header

#### `ai-chat-empty.tsx`
Shown when a new/empty session is selected:
- Small CertWall logo or ShieldCheck icon
- **"How can I help?"** heading
- `suggested-questions.tsx` rendered below

#### `ai-chat-usage.tsx`
Small inline indicator below the input:
- Text: "12 of 50 messages today"
- Thin progress bar (brand green fill)
- Turns yellow at >80% usage, red at 100%
- At 100%: "Daily limit reached — resets at midnight UTC" + message input disabled

#### `suggested-questions.tsx`
Shows 4 clickable pill/chip buttons from a pool of ~12 questions. Display 4 randomly per session. Clicking one sends it as a message immediately.

Pool:
```typescript
const SUGGESTED_QUESTIONS = [
  "How do I upload a Certificate of Insurance?",
  "What do the fields on an ACORD 25 mean?",
  "Why is my vendor showing as non-compliant?",
  "How do I add someone as additional insured?",
  "What's the difference between occurrence and claims-made?",
  "How do compliance templates work?",
  "How do I invite a team member?",
  "What file formats can I upload?",
  "How do I export an audit report?",
  "What does waiver of subrogation mean?",
  "How do the reminder stages work?",
  "What's the difference between certificate holder and additional insured?",
];
```

#### `ai-escalate-dialog.tsx`
A shadcn `Dialog` for converting the current chat into a support ticket:
- Subject input (pre-filled from session title)
- Priority select (low/medium/high/urgent) — uses existing `cw_ticket_priority` enum
- Read-only preview showing first ~3 messages truncated
- **"Create Ticket"** button → `POST /api/support/ai/escalate`
- On success: sonner toast "Support ticket created", auto-switch to Tickets tab

---

### STEP 9 — UPDATE THE SUPPORT PAGE

Modify `src/app/(app)/support/page.tsx` to implement the new two-tab layout:

```
Page header: "Support" with description "Get help with CertWall"

<SupportTabs>
  <Tab: "AI Assistant">
    IF org.plan_tier is 'growth' | 'pro' | 'scale' AND org.subscription_status is 'active' | 'trialing':
      → <AiChat />
    ELSE:
      → <AiChatLocked />
  </Tab>

  <Tab: "Support Tickets">
    → Existing ticket-form.tsx, ticket-list.tsx, ticket-detail.tsx (from original spec Section 10)
    → These work for ALL plan tiers
  </Tab>
</SupportTabs>

Quick help footer:
  - Getting Started → /blog/what-is-a-coi
  - FAQ → /#faq
  - Email: support@certwall.com
```

The plan tier check: fetch the org data server-side (or via the existing `use-org` hook from `src/hooks/use-org.ts`) and pass `planTier` and `subscriptionStatus` to the component.

---

### STEP 10 — RATE LIMIT LOGIC

Server-side in the chat API route, check before every API call:

```typescript
function getAiMessageLimit(planTier: string): number {
  switch (planTier) {
    case 'growth': return 50;
    case 'pro': return 200;
    case 'scale': return Infinity;
    default: return 0;
  }
}
```

Query `cw_ai_chat_usage` for `user_id` + `usage_date = CURRENT_DATE`. If `message_count >= limit`, return 429 with a message including the limit and plan name.

On the frontend, `ai-chat-usage.tsx` calls `GET /api/support/ai/usage` on mount and after each message send to stay in sync.

---

### STEP 11 — KEY IMPLEMENTATION DETAILS

**Streaming pattern**: Use `ReadableStream` + `TextEncoder` on the server to emit SSE events. On the client, use `fetch` + `response.body.getReader()` + `TextDecoder` to read them. Do NOT use WebSockets or EventSource — a plain streaming fetch is simpler and works fine with Next.js API routes.

**Message history for context**: When building the Anthropic `messages` array, include up to the 50 most recent messages from the session. This keeps the context window manageable (~25 exchanges). Older messages are still visible in the UI but not sent to the API.

**Session title auto-generation**: After the first user message is saved, update the session title to the first 100 characters of that message. This gives the session sidebar meaningful labels.

**Dark mode**: All chat components must use CSS variables from the existing design system. User message bubbles: `bg-primary text-primary-foreground`. Assistant messages: `bg-card text-card-foreground`. Use the existing shadcn/ui theme tokens.

**Mobile responsive**: At `<md` breakpoint, the session sidebar hides and becomes a Sheet. The chat area takes full width. Input stays fixed at bottom. Message bubbles get smaller padding. Follow the mobile requirements from Section 16.

**Markdown rendering**: Use `react-markdown` with `remark-gfm`. Style the rendered markdown inside assistant messages with Tailwind `prose prose-sm` class (from `@tailwindcss/typography` if available, or manual prose styles). Ensure links, code blocks, bold text, tables, and lists render properly in both light and dark mode.

---

### FILES TO CREATE

```
supabase/migrations/002_ai_helpdesk.sql
src/lib/anthropic/client.ts
src/lib/anthropic/helpdesk-prompt.ts
src/app/api/support/ai/chat/route.ts
src/app/api/support/ai/sessions/route.ts
src/app/api/support/ai/sessions/[id]/route.ts
src/app/api/support/ai/usage/route.ts
src/app/api/support/ai/escalate/route.ts
src/hooks/use-ai-chat.ts
src/components/support/support-tabs.tsx
src/components/support/ai-chat.tsx
src/components/support/ai-chat-message.tsx
src/components/support/ai-chat-input.tsx
src/components/support/ai-chat-sidebar.tsx
src/components/support/ai-chat-empty.tsx
src/components/support/ai-chat-locked.tsx
src/components/support/ai-chat-usage.tsx
src/components/support/ai-escalate-dialog.tsx
src/components/support/suggested-questions.tsx
```

### FILES TO MODIFY

```
src/app/(app)/support/page.tsx         — Replace with tabbed layout
.env.example                           — Add ANTHROPIC_API_KEY
package.json                           — Added via npm install
```

### EXISTING FILES TO KEEP (from original spec — still needed for Tickets tab)

```
src/components/support/ticket-form.tsx
src/components/support/ticket-list.tsx
src/components/support/ticket-detail.tsx
src/components/support/ticket-reply.tsx
src/app/api/support/tickets/route.ts
src/app/api/support/tickets/[id]/route.ts
src/app/api/support/tickets/[id]/reply/route.ts
```

---

### NON-NEGOTIABLE REQUIREMENTS

1. **RLS on everything.** The three new tables must have RLS enabled. No user must ever see another user's chat sessions. Follow the exact pattern from Section 4.
2. **Service role for streaming writes.** Use `createServiceClient()` (the service role client from Section 4 notes) when saving messages during streaming and incrementing usage — the streaming handler runs outside the normal request auth context.
3. **System prompt must be comprehensive.** The prompt IS the AI's knowledge base. It must cover every CertWall feature with navigation paths, every ACORD 25 field with explanations, and common troubleshooting scenarios. Do not abbreviate it.
4. **Streaming must work.** Token-by-token rendering is essential for a good chat UX. Test that the SSE stream works end-to-end.
5. **Plan gating is server-side.** The API route must reject requests from Starter-tier orgs with a 403. Client-side gating (showing the locked UI) is cosmetic only — the API is the real gate.
6. **Rate limits are server-side.** Check `cw_ai_chat_usage` in the API before every Anthropic call. Client-side usage display is informational only.
7. **Follow the design system.** Warm palette, DM Sans + DM Serif Display, shadcn/ui, dark mode via CSS variables. Read Section 8.
8. **Escalation preserves context.** When a chat becomes a ticket, the full conversation history must be included in the ticket description so the human support agent has context.
9. **The ticket system still works.** The Tickets tab must render the existing ticket components for all plan tiers including Starter. AI chat is additive, not destructive.

---

### IMPLEMENTATION ORDER

Do these in sequence. Each step should compile and work before moving to the next:

1. Run the database migration (002_ai_helpdesk.sql)
2. Create `lib/anthropic/client.ts` — verify it initializes without error
3. Create `lib/anthropic/helpdesk-prompt.ts` — the full system prompt
4. Create the API routes — start with `sessions` (GET/POST/DELETE), then `usage`, then `chat` (the hardest one — streaming), then `escalate`
5. Create the `use-ai-chat` hook
6. Create the UI components — start with `support-tabs.tsx` and `ai-chat-locked.tsx` (simplest), then build out `ai-chat.tsx` and its sub-components
7. Update `support/page.tsx` to use the new tabbed layout
8. Test the full flow: create session → send message → see streaming response → check usage → escalate to ticket → verify ticket exists in Tickets tab

---

## PROMPT ENDS HERE
