CREATE TABLE cw_compliance_status (
  vendor_id UUID PRIMARY KEY REFERENCES cw_vendors(id),
  status cw_compliance_status_enum NOT NULL DEFAULT 'red',
  reasons_json JSONB DEFAULT '[]'::jsonb,
  next_expiry_date DATE,
  last_checked_at TIMESTAMPTZ DEFAULT now()
);
