-- ============================================================
-- COIStack Production Schema Migration
-- Run AFTER the POC migrations (000_all_in_one.sql)
-- ============================================================

-- -------------------------------------------------------
-- 1. NEW ENUMS
-- -------------------------------------------------------

-- Extend existing trade_type enum with more trades
ALTER TYPE cw_trade_type ADD VALUE IF NOT EXISTS 'ELECTRICAL';
ALTER TYPE cw_trade_type ADD VALUE IF NOT EXISTS 'PLUMBING';
ALTER TYPE cw_trade_type ADD VALUE IF NOT EXISTS 'ROOFING';
ALTER TYPE cw_trade_type ADD VALUE IF NOT EXISTS 'LANDSCAPING';
ALTER TYPE cw_trade_type ADD VALUE IF NOT EXISTS 'OTHER';

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

-- -------------------------------------------------------
-- 2. NEW TABLES
-- -------------------------------------------------------

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
  vendor_limit INTEGER NOT NULL DEFAULT 75,
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

-- -------------------------------------------------------
-- 3. ALTER EXISTING POC TABLES — add org_id + new columns
-- -------------------------------------------------------

-- cw_vendors
ALTER TABLE cw_vendors ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_vendors ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE cw_vendors ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE cw_vendors ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE cw_vendors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- cw_documents
ALTER TABLE cw_documents ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_documents ADD COLUMN IF NOT EXISTS file_name TEXT NOT NULL DEFAULT '';
ALTER TABLE cw_documents ADD COLUMN IF NOT EXISTS file_size INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cw_documents ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

-- cw_coi_extractions
ALTER TABLE cw_coi_extractions ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_coi_extractions ADD COLUMN IF NOT EXISTS review_notes TEXT;
ALTER TABLE cw_coi_extractions ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE cw_coi_extractions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- cw_compliance_status
ALTER TABLE cw_compliance_status ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;

-- cw_reminder_log
ALTER TABLE cw_reminder_log ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;

-- cw_requirements_templates — restructure to per-org
ALTER TABLE cw_requirements_templates ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE cw_requirements_templates ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES cw_organizations(id) ON DELETE CASCADE;
ALTER TABLE cw_requirements_templates ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE cw_requirements_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- -------------------------------------------------------
-- 4. INDEXES
-- -------------------------------------------------------

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

-- -------------------------------------------------------
-- 5. HELPER FUNCTIONS
-- -------------------------------------------------------

-- Get the current user's org_id
CREATE OR REPLACE FUNCTION cw_get_user_org_id()
RETURNS UUID AS $$
  SELECT org_id FROM cw_org_memberships
  WHERE user_id = auth.uid()
  ORDER BY joined_at ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- -------------------------------------------------------
-- 6. TRIGGERS
-- -------------------------------------------------------

-- Auto-create user profile on signup (best-effort, won't block signup if it fails)
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

-- -------------------------------------------------------
-- 7. ROW-LEVEL SECURITY
-- -------------------------------------------------------

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
