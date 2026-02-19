CREATE TABLE cw_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES cw_vendors(id),
  file_url TEXT NOT NULL,
  checksum TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'upload',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cw_documents_vendor_id ON cw_documents(vendor_id);
CREATE INDEX idx_cw_documents_checksum ON cw_documents(vendor_id, checksum);
