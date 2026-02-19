-- Audit log table for tracking all significant actions
CREATE TABLE IF NOT EXISTS cw_audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  action     text NOT NULL,
  target_type text,
  target_id   text,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for querying by org + time
CREATE INDEX idx_audit_log_org_time ON cw_audit_log (org_id, created_at DESC);

-- Index for querying by action type
CREATE INDEX idx_audit_log_action ON cw_audit_log (org_id, action);

-- RLS
ALTER TABLE cw_audit_log ENABLE ROW LEVEL SECURITY;

-- Only org owners/admins can read audit logs
CREATE POLICY "Org members can view audit logs"
  ON cw_audit_log FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM cw_org_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Contact sales inquiries table
CREATE TABLE IF NOT EXISTS cw_contact_sales (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  email      text NOT NULL,
  company    text NOT NULL,
  vendor_count text,
  message    text,
  source     text DEFAULT 'pricing_page',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- MFA enforcement setting (stored on org)
ALTER TABLE cw_organizations ADD COLUMN IF NOT EXISTS mfa_enforced boolean NOT NULL DEFAULT false;
