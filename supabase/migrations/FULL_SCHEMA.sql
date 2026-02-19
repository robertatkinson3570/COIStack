-- ============================================================
-- COIStack FULL SCHEMA — Consolidated Migration
-- Paste this entire file into Supabase SQL Editor and run it.
-- This combines: 000 (POC) + 001 (Production) + 008 (Grader)
--                + 009 (AI Helpdesk) + 010 (V2 Features)
--
-- NOTE: If you previously ran the POC migration (000_all_in_one.sql),
-- you must first drop the old trade_type enum so it can be recreated
-- with all values. Uncomment the line below if needed:
-- DROP TYPE IF EXISTS cw_trade_type CASCADE;
-- ============================================================

-- ===============================
-- PART 1: POC BASE TABLES (000)
-- ===============================

-- Enums (cw_trade_type includes all production values from the start)
DO $$ BEGIN
  CREATE TYPE cw_trade_type AS ENUM ('GC', 'HVAC', 'CLEANING', 'ELECTRICAL', 'PLUMBING', 'ROOFING', 'LANDSCAPING', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cw_compliance_status_enum AS ENUM ('green', 'yellow', 'red');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cw_reminder_stage AS ENUM ('30d', '14d', '7d', '1d', 'expired_weekly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendors
CREATE TABLE IF NOT EXISTS cw_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  trade_type cw_trade_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Documents
CREATE TABLE IF NOT EXISTS cw_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES cw_vendors(id),
  file_url TEXT NOT NULL,
  checksum TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'upload',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cw_documents_vendor_id ON cw_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cw_documents_checksum ON cw_documents(vendor_id, checksum);

-- COI Extractions
CREATE TABLE IF NOT EXISTS cw_coi_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES cw_documents(id),
  extracted_json JSONB NOT NULL,
  confidence FLOAT,
  needs_review BOOLEAN DEFAULT false,
  extracted_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cw_coi_extractions_document_id ON cw_coi_extractions(document_id);

-- Compliance Status
CREATE TABLE IF NOT EXISTS cw_compliance_status (
  vendor_id UUID PRIMARY KEY REFERENCES cw_vendors(id),
  status cw_compliance_status_enum NOT NULL DEFAULT 'red',
  reasons_json JSONB DEFAULT '[]'::jsonb,
  next_expiry_date DATE,
  last_checked_at TIMESTAMPTZ DEFAULT now()
);

-- Reminder Log
CREATE TABLE IF NOT EXISTS cw_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES cw_vendors(id),
  stage cw_reminder_stage NOT NULL,
  message_preview TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cw_reminder_log_vendor_id ON cw_reminder_log(vendor_id);
CREATE INDEX IF NOT EXISTS idx_cw_reminder_log_sent_at ON cw_reminder_log(sent_at);

-- Requirements Templates
CREATE TABLE IF NOT EXISTS cw_requirements_templates (
  trade_type cw_trade_type PRIMARY KEY,
  rules_json JSONB NOT NULL
);

-- Seed requirement templates
INSERT INTO cw_requirements_templates (trade_type, rules_json) VALUES
  ('GC', '{
    "gl_each_occurrence_min": 1000000,
    "gl_aggregate_min": 2000000,
    "workers_comp_required": true,
    "additional_insured_required": true,
    "waiver_of_subrogation_required": true,
    "yellow_days_before_expiry": 30
  }'::jsonb),
  ('HVAC', '{
    "gl_each_occurrence_min": 1000000,
    "gl_aggregate_min": 2000000,
    "workers_comp_required": true,
    "additional_insured_required": true,
    "waiver_of_subrogation_required": true,
    "yellow_days_before_expiry": 30
  }'::jsonb),
  ('CLEANING', '{
    "gl_each_occurrence_min": 1000000,
    "gl_aggregate_min": 2000000,
    "workers_comp_required": true,
    "additional_insured_required": false,
    "waiver_of_subrogation_required": false,
    "yellow_days_before_expiry": 30
  }'::jsonb)
ON CONFLICT (trade_type) DO NOTHING;


-- ================================================
-- PART 2: PRODUCTION SCHEMA (001)
-- ================================================

-- (cw_trade_type already created with all values in Part 1)

-- New enums for production
DO $$ BEGIN
  CREATE TYPE cw_user_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cw_invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cw_plan_tier AS ENUM ('starter', 'growth', 'pro', 'scale');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cw_subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cw_ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cw_ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Organizations
CREATE TABLE IF NOT EXISTS cw_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan_tier cw_plan_tier NOT NULL DEFAULT 'starter',
  subscription_status cw_subscription_status NOT NULL DEFAULT 'trialing',
  vendor_limit INTEGER NOT NULL DEFAULT 100,
  vendor_count INTEGER NOT NULL DEFAULT 0,
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS cw_user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization memberships
CREATE TABLE IF NOT EXISTS cw_org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role cw_user_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Invites
CREATE TABLE IF NOT EXISTS cw_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role cw_user_role NOT NULL DEFAULT 'member',
  status cw_invite_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support tickets
CREATE TABLE IF NOT EXISTS cw_support_tickets (
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

-- Ticket messages
CREATE TABLE IF NOT EXISTS cw_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES cw_support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  is_staff BOOLEAN NOT NULL DEFAULT FALSE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ALTER EXISTING POC TABLES — add org_id + new columns
ALTER TABLE cw_vendors ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_vendors ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE cw_vendors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE cw_vendors ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE cw_vendors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE cw_documents ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_documents ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL DEFAULT '';
ALTER TABLE cw_documents ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cw_documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

ALTER TABLE cw_coi_extractions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_coi_extractions ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE cw_coi_extractions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE cw_coi_extractions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE cw_compliance_status ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;

ALTER TABLE cw_reminder_log ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;

ALTER TABLE cw_requirements_templates ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE cw_requirements_templates ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_requirements_templates ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE cw_requirements_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON cw_org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON cw_org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_vendors_org ON cw_vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_org ON cw_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_documents_vendor ON cw_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_extractions_document ON cw_coi_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_extractions_org ON cw_coi_extractions(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_org ON cw_compliance_status(org_id);
CREATE INDEX IF NOT EXISTS idx_reminders_org ON cw_reminder_log(org_id);
CREATE INDEX IF NOT EXISTS idx_invites_token ON cw_invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_org ON cw_invites(org_id);
CREATE INDEX IF NOT EXISTS idx_tickets_org ON cw_support_tickets(org_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON cw_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON cw_organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe ON cw_organizations(stripe_customer_id);

-- Helper function: get current user's org
CREATE OR REPLACE FUNCTION cw_get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM cw_org_memberships
  WHERE user_id = auth.uid()
  ORDER BY joined_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- TRIGGERS

-- Auto-create user profile on signup (best-effort, won't block signup if it fails)
-- The app also creates profiles via ensureUserProfile() in setup-org as a fallback.
CREATE OR REPLACE FUNCTION cw_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cw_user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION cw_handle_new_user();

-- Auto-update vendor_count on org
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

DROP TRIGGER IF EXISTS on_vendor_change ON cw_vendors;
CREATE TRIGGER on_vendor_change
  AFTER INSERT OR DELETE ON cw_vendors
  FOR EACH ROW EXECUTE FUNCTION cw_update_vendor_count();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION cw_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cw_organizations_updated_at ON cw_organizations;
CREATE TRIGGER cw_organizations_updated_at
  BEFORE UPDATE ON cw_organizations
  FOR EACH ROW EXECUTE FUNCTION cw_update_timestamp();

DROP TRIGGER IF EXISTS cw_user_profiles_updated_at ON cw_user_profiles;
CREATE TRIGGER cw_user_profiles_updated_at
  BEFORE UPDATE ON cw_user_profiles
  FOR EACH ROW EXECUTE FUNCTION cw_update_timestamp();

-- ROW-LEVEL SECURITY
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

-- Drop existing policies (safe to run on fresh DB)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their organizations" ON cw_organizations;
  DROP POLICY IF EXISTS "Owners can update their organization" ON cw_organizations;
  DROP POLICY IF EXISTS "Users can view own profile" ON cw_user_profiles;
  DROP POLICY IF EXISTS "Users can view org member profiles" ON cw_user_profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON cw_user_profiles;
  DROP POLICY IF EXISTS "Users can view memberships in their orgs" ON cw_org_memberships;
  DROP POLICY IF EXISTS "Owners/admins can insert memberships" ON cw_org_memberships;
  DROP POLICY IF EXISTS "Owners can delete memberships" ON cw_org_memberships;
  DROP POLICY IF EXISTS "Org members can view invites" ON cw_invites;
  DROP POLICY IF EXISTS "Owners/admins can create invites" ON cw_invites;
  DROP POLICY IF EXISTS "Owners/admins can update invites" ON cw_invites;
  DROP POLICY IF EXISTS "Org members can view their vendors" ON cw_vendors;
  DROP POLICY IF EXISTS "Org members (not viewers) can insert vendors" ON cw_vendors;
  DROP POLICY IF EXISTS "Org members (not viewers) can update vendors" ON cw_vendors;
  DROP POLICY IF EXISTS "Owners/admins can delete vendors" ON cw_vendors;
  DROP POLICY IF EXISTS "Org members can view their documents" ON cw_documents;
  DROP POLICY IF EXISTS "Org members (not viewers) can insert documents" ON cw_documents;
  DROP POLICY IF EXISTS "Org members can view their extractions" ON cw_coi_extractions;
  DROP POLICY IF EXISTS "Org members (not viewers) can insert extractions" ON cw_coi_extractions;
  DROP POLICY IF EXISTS "Org members can view compliance" ON cw_compliance_status;
  DROP POLICY IF EXISTS "System can upsert compliance" ON cw_compliance_status;
  DROP POLICY IF EXISTS "Org members can view reminders" ON cw_reminder_log;
  DROP POLICY IF EXISTS "System can insert reminders" ON cw_reminder_log;
  DROP POLICY IF EXISTS "Org members can view templates" ON cw_requirements_templates;
  DROP POLICY IF EXISTS "Owners/admins can manage templates" ON cw_requirements_templates;
  DROP POLICY IF EXISTS "Org members can view their tickets" ON cw_support_tickets;
  DROP POLICY IF EXISTS "Org members can create tickets" ON cw_support_tickets;
  DROP POLICY IF EXISTS "Ticket creator can update" ON cw_support_tickets;
  DROP POLICY IF EXISTS "Users can view messages on their tickets" ON cw_ticket_messages;
  DROP POLICY IF EXISTS "Users can add messages to their tickets" ON cw_ticket_messages;
END $$;

-- ORGANIZATIONS
CREATE POLICY "Users can view their organizations"
  ON cw_organizations FOR SELECT
  USING (id IN (SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Owners can update their organization"
  ON cw_organizations FOR UPDATE
  USING (id IN (SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role = 'owner'));

-- USER PROFILES
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

-- ORG MEMBERSHIPS
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
  ) OR user_id = auth.uid());

-- INVITES
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

-- VENDORS
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

-- DOCUMENTS
CREATE POLICY "Org members can view their documents"
  ON cw_documents FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members (not viewers) can insert documents"
  ON cw_documents FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

-- EXTRACTIONS
CREATE POLICY "Org members can view their extractions"
  ON cw_coi_extractions FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members (not viewers) can insert extractions"
  ON cw_coi_extractions FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

-- COMPLIANCE STATUS
CREATE POLICY "Org members can view compliance"
  ON cw_compliance_status FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "System can upsert compliance"
  ON cw_compliance_status FOR ALL
  USING (org_id = cw_get_user_org_id());

-- REMINDER LOG
CREATE POLICY "Org members can view reminders"
  ON cw_reminder_log FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "System can insert reminders"
  ON cw_reminder_log FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
  ));

-- TEMPLATES
CREATE POLICY "Org members can view templates"
  ON cw_requirements_templates FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Owners/admins can manage templates"
  ON cw_requirements_templates FOR ALL
  USING (org_id IN (
    SELECT org_id FROM cw_org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- SUPPORT TICKETS
CREATE POLICY "Org members can view their tickets"
  ON cw_support_tickets FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can create tickets"
  ON cw_support_tickets FOR INSERT
  WITH CHECK (org_id = cw_get_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Ticket creator can update"
  ON cw_support_tickets FOR UPDATE
  USING (user_id = auth.uid());

-- TICKET MESSAGES
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


-- ================================================
-- PART 3: COI GRADER TABLES (008)
-- ================================================

CREATE TABLE IF NOT EXISTS cw_grader_uploads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token  TEXT UNIQUE NOT NULL,
  file_path     TEXT NOT NULL,
  file_name     TEXT NOT NULL,
  file_size     BIGINT NOT NULL,
  file_type     TEXT NOT NULL,
  ip_hash       TEXT NOT NULL,
  template_key  TEXT NOT NULL DEFAULT 'standard_commercial',
  status        TEXT NOT NULL DEFAULT 'processing'
                CHECK (status IN ('processing', 'completed', 'failed')),
  error_message TEXT,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grader_uploads_token   ON cw_grader_uploads(public_token);
CREATE INDEX IF NOT EXISTS idx_grader_uploads_rate    ON cw_grader_uploads(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_grader_uploads_expires ON cw_grader_uploads(expires_at);

CREATE TABLE IF NOT EXISTS cw_grader_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id         UUID NOT NULL UNIQUE REFERENCES cw_grader_uploads(id) ON DELETE CASCADE,
  extracted_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence        REAL,
  overall_grade     TEXT NOT NULL
                    CHECK (overall_grade IN ('COMPLIANT', 'AT_RISK', 'NON_COMPLIANT')),
  checks_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
  pass_count        SMALLINT NOT NULL DEFAULT 0,
  fail_count        SMALLINT NOT NULL DEFAULT 0,
  unknown_count     SMALLINT NOT NULL DEFAULT 0,
  email_unlocked    BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_by_user_id UUID,
  unlocked_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grader_results_upload ON cw_grader_results(upload_id);

CREATE TABLE IF NOT EXISTS cw_lead_captures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  upload_id   UUID REFERENCES cw_grader_uploads(id) ON DELETE SET NULL,
  user_id     UUID,
  source      TEXT NOT NULL DEFAULT 'grader',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_captures_email  ON cw_lead_captures(email);
CREATE INDEX IF NOT EXISTS idx_lead_captures_upload ON cw_lead_captures(upload_id);

CREATE TABLE IF NOT EXISTS cw_grader_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id   UUID REFERENCES cw_grader_uploads(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grader_events_upload ON cw_grader_events(upload_id);

ALTER TABLE cw_grader_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_grader_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_lead_captures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_grader_events  ENABLE ROW LEVEL SECURITY;


-- ================================================
-- PART 4: AI HELPDESK (009)
-- ================================================

CREATE TABLE IF NOT EXISTS cw_ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cw_ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cw_ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cw_ai_chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_org ON cw_ai_chat_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON cw_ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON cw_ai_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON cw_ai_chat_usage(user_id, usage_date);

ALTER TABLE cw_ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_ai_chat_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own chat sessions" ON cw_ai_chat_sessions;
  DROP POLICY IF EXISTS "Users can create chat sessions" ON cw_ai_chat_sessions;
  DROP POLICY IF EXISTS "Users can delete own chat sessions" ON cw_ai_chat_sessions;
  DROP POLICY IF EXISTS "Users can view messages in own sessions" ON cw_ai_chat_messages;
  DROP POLICY IF EXISTS "Users can insert messages in own sessions" ON cw_ai_chat_messages;
  DROP POLICY IF EXISTS "Users can view own usage" ON cw_ai_chat_usage;
END $$;

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

-- Usage increment function
CREATE OR REPLACE FUNCTION cw_increment_ai_usage(p_user_id UUID, p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO cw_ai_chat_usage (user_id, org_id, usage_date, message_count)
  VALUES (p_user_id, p_org_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET message_count = cw_ai_chat_usage.message_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ================================================
-- PART 5: V2 FEATURES (010)
-- ================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE cw_integration_provider AS ENUM ('appfolio', 'yardi', 'buildium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cw_integration_status AS ENUM ('pending', 'active', 'error', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE cw_ingest_status AS ENUM ('matched', 'unmatched', 'processed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vendor self-service portal links
CREATE TABLE IF NOT EXISTS cw_vendor_portal_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES cw_vendors(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Integration provider configuration
CREATE TABLE IF NOT EXISTS cw_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  provider cw_integration_provider NOT NULL,
  api_key_encrypted TEXT,
  status cw_integration_status NOT NULL DEFAULT 'pending',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, provider)
);

-- Integration interest / waitlist
CREATE TABLE IF NOT EXISTS cw_integration_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  provider cw_integration_provider NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, provider)
);

-- Per-org email ingest addresses
CREATE TABLE IF NOT EXISTS cw_email_ingest_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES cw_organizations(id) ON DELETE CASCADE,
  ingest_email TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email ingest processing log
CREATE TABLE IF NOT EXISTS cw_email_ingest_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  subject TEXT,
  vendor_id_matched UUID REFERENCES cw_vendors(id) ON DELETE SET NULL,
  document_id UUID REFERENCES cw_documents(id) ON DELETE SET NULL,
  status cw_ingest_status NOT NULL DEFAULT 'failed',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historical compliance snapshots
CREATE TABLE IF NOT EXISTS cw_compliance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES cw_vendors(id) ON DELETE CASCADE,
  status cw_compliance_status_enum NOT NULL,
  reasons_json JSONB NOT NULL DEFAULT '[]',
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_links_org ON cw_vendor_portal_links(org_id);
CREATE INDEX IF NOT EXISTS idx_portal_links_vendor ON cw_vendor_portal_links(vendor_id);
CREATE INDEX IF NOT EXISTS idx_portal_links_token ON cw_vendor_portal_links(token);
CREATE INDEX IF NOT EXISTS idx_integrations_org ON cw_integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_integration_interest_org ON cw_integration_interest(org_id);
CREATE INDEX IF NOT EXISTS idx_email_ingest_org ON cw_email_ingest_addresses(org_id);
CREATE INDEX IF NOT EXISTS idx_email_ingest_log_org ON cw_email_ingest_log(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_org ON cw_compliance_snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_vendor ON cw_compliance_snapshots(vendor_id);
CREATE INDEX IF NOT EXISTS idx_compliance_snapshots_date ON cw_compliance_snapshots(snapshot_date);

-- RLS
ALTER TABLE cw_vendor_portal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_integration_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_email_ingest_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_email_ingest_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_compliance_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Org members can view portal links" ON cw_vendor_portal_links;
  DROP POLICY IF EXISTS "Org members can create portal links" ON cw_vendor_portal_links;
  DROP POLICY IF EXISTS "Org members can update portal links" ON cw_vendor_portal_links;
  DROP POLICY IF EXISTS "Org members can view integrations" ON cw_integrations;
  DROP POLICY IF EXISTS "Org members can manage integrations" ON cw_integrations;
  DROP POLICY IF EXISTS "Org members can view integration interest" ON cw_integration_interest;
  DROP POLICY IF EXISTS "Org members can register interest" ON cw_integration_interest;
  DROP POLICY IF EXISTS "Org members can view email ingest addresses" ON cw_email_ingest_addresses;
  DROP POLICY IF EXISTS "Org members can view email ingest log" ON cw_email_ingest_log;
  DROP POLICY IF EXISTS "Org members can view compliance snapshots" ON cw_compliance_snapshots;
END $$;

CREATE POLICY "Org members can view portal links"
  ON cw_vendor_portal_links FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can create portal links"
  ON cw_vendor_portal_links FOR INSERT
  WITH CHECK (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can update portal links"
  ON cw_vendor_portal_links FOR UPDATE
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can view integrations"
  ON cw_integrations FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can manage integrations"
  ON cw_integrations FOR ALL
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can view integration interest"
  ON cw_integration_interest FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can register interest"
  ON cw_integration_interest FOR INSERT
  WITH CHECK (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can view email ingest addresses"
  ON cw_email_ingest_addresses FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can view email ingest log"
  ON cw_email_ingest_log FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can view compliance snapshots"
  ON cw_compliance_snapshots FOR SELECT
  USING (org_id = cw_get_user_org_id());

-- V2 Triggers

-- Auto-create email ingest address when a new org is created
CREATE OR REPLACE FUNCTION cw_auto_create_ingest_address()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cw_email_ingest_addresses (org_id, ingest_email)
  VALUES (NEW.id, 'coi-' || NEW.slug || '@ingest.coistack.com')
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_ingest_address ON cw_organizations;
CREATE TRIGGER trg_auto_ingest_address
  AFTER INSERT ON cw_organizations
  FOR EACH ROW
  EXECUTE FUNCTION cw_auto_create_ingest_address();

-- Auto-snapshot compliance status changes
CREATE OR REPLACE FUNCTION cw_auto_snapshot_compliance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cw_compliance_snapshots (org_id, vendor_id, status, reasons_json, snapshot_date)
  VALUES (NEW.org_id, NEW.vendor_id, NEW.status, to_jsonb(NEW.reasons_json), CURRENT_DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_compliance_snapshot ON cw_compliance_status;
CREATE TRIGGER trg_compliance_snapshot
  AFTER INSERT OR UPDATE ON cw_compliance_status
  FOR EACH ROW
  EXECUTE FUNCTION cw_auto_snapshot_compliance();

-- Update default vendor limit for new orgs
ALTER TABLE cw_organizations ALTER COLUMN vendor_limit SET DEFAULT 100;


-- ================================================
-- PART 6: SUPABASE STORAGE BUCKET
-- ================================================

-- Create the storage bucket for COI documents (run once)
INSERT INTO storage.buckets (id, name, public)
VALUES ('coi-documents', 'coi-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload COIs" ON storage.objects;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Authenticated users can upload COIs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'coi-documents' AND auth.role() = 'authenticated');

DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read own COIs" ON storage.objects;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Authenticated users can read own COIs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'coi-documents' AND auth.role() = 'authenticated');


-- ============================================================
-- DONE! All COIStack tables, triggers, RLS, and storage ready.
-- ============================================================
