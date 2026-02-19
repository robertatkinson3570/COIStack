CREATE TABLE cw_coi_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES cw_documents(id),
  extracted_json JSONB NOT NULL,
  confidence FLOAT,
  needs_review BOOLEAN DEFAULT false,
  extracted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cw_coi_extractions_document_id ON cw_coi_extractions(document_id);
