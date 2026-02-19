-- ============================================================
-- COIStack V2 Features — Database Migration
-- Tables: vendor_portal_links, integrations, integration_interest,
--         email_ingest_addresses, email_ingest_log, compliance_snapshots
-- ============================================================

-- -------------------------------------------------------
-- 1. ENUMS
-- -------------------------------------------------------

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

-- -------------------------------------------------------
-- 2. TABLES
-- -------------------------------------------------------

-- Vendor self-service portal links (token-based public upload)
CREATE TABLE cw_vendor_portal_links (
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
CREATE TABLE cw_integrations (
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

-- Integration "Coming Soon" interest / waitlist
CREATE TABLE cw_integration_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  provider cw_integration_provider NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, provider)
);

-- Per-org email ingest forwarding addresses
CREATE TABLE cw_email_ingest_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES cw_organizations(id) ON DELETE CASCADE,
  ingest_email TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email ingest processing log
CREATE TABLE cw_email_ingest_log (
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

-- Historical compliance snapshots (point-in-time records)
CREATE TABLE cw_compliance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES cw_vendors(id) ON DELETE CASCADE,
  status cw_compliance_status_enum NOT NULL,
  reasons_json JSONB NOT NULL DEFAULT '[]',
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- 3. INDEXES
-- -------------------------------------------------------

CREATE INDEX idx_portal_links_org ON cw_vendor_portal_links(org_id);
CREATE INDEX idx_portal_links_vendor ON cw_vendor_portal_links(vendor_id);
CREATE INDEX idx_portal_links_token ON cw_vendor_portal_links(token);
CREATE INDEX idx_integrations_org ON cw_integrations(org_id);
CREATE INDEX idx_integration_interest_org ON cw_integration_interest(org_id);
CREATE INDEX idx_email_ingest_org ON cw_email_ingest_addresses(org_id);
CREATE INDEX idx_email_ingest_log_org ON cw_email_ingest_log(org_id);
CREATE INDEX idx_compliance_snapshots_org ON cw_compliance_snapshots(org_id);
CREATE INDEX idx_compliance_snapshots_vendor ON cw_compliance_snapshots(vendor_id);
CREATE INDEX idx_compliance_snapshots_date ON cw_compliance_snapshots(snapshot_date);

-- -------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -------------------------------------------------------

ALTER TABLE cw_vendor_portal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_integration_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_email_ingest_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_email_ingest_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_compliance_snapshots ENABLE ROW LEVEL SECURITY;

-- Portal links — org members can view/manage
CREATE POLICY "Org members can view portal links"
  ON cw_vendor_portal_links FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can create portal links"
  ON cw_vendor_portal_links FOR INSERT
  WITH CHECK (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can update portal links"
  ON cw_vendor_portal_links FOR UPDATE
  USING (org_id = cw_get_user_org_id());

-- Integrations — org members can view
CREATE POLICY "Org members can view integrations"
  ON cw_integrations FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can manage integrations"
  ON cw_integrations FOR ALL
  USING (org_id = cw_get_user_org_id());

-- Integration interest — org members can manage
CREATE POLICY "Org members can view integration interest"
  ON cw_integration_interest FOR SELECT
  USING (org_id = cw_get_user_org_id());

CREATE POLICY "Org members can register interest"
  ON cw_integration_interest FOR INSERT
  WITH CHECK (org_id = cw_get_user_org_id());

-- Email ingest addresses — org members can view
CREATE POLICY "Org members can view email ingest addresses"
  ON cw_email_ingest_addresses FOR SELECT
  USING (org_id = cw_get_user_org_id());

-- Email ingest log — org members can view
CREATE POLICY "Org members can view email ingest log"
  ON cw_email_ingest_log FOR SELECT
  USING (org_id = cw_get_user_org_id());

-- Compliance snapshots — org members can view
CREATE POLICY "Org members can view compliance snapshots"
  ON cw_compliance_snapshots FOR SELECT
  USING (org_id = cw_get_user_org_id());

-- -------------------------------------------------------
-- 5. TRIGGERS
-- -------------------------------------------------------

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

CREATE TRIGGER trg_compliance_snapshot
  AFTER INSERT OR UPDATE ON cw_compliance_status
  FOR EACH ROW
  EXECUTE FUNCTION cw_auto_snapshot_compliance();

-- -------------------------------------------------------
-- 6. ALTER EXISTING TABLES
-- -------------------------------------------------------

-- Update default vendor limit for new orgs to 100
ALTER TABLE cw_organizations ALTER COLUMN vendor_limit SET DEFAULT 100;
