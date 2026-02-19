-- COIStack POC — All tables (prefixed with cw_ to avoid conflicts)
-- Run this in the Supabase SQL Editor

-- Enums
CREATE TYPE cw_trade_type AS ENUM ('GC', 'HVAC', 'CLEANING');
CREATE TYPE cw_compliance_status_enum AS ENUM ('green', 'yellow', 'red');
CREATE TYPE cw_reminder_stage AS ENUM ('30d', '14d', '7d', '1d', 'expired_weekly');

-- Vendors
CREATE TABLE cw_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  trade_type cw_trade_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Documents
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

-- COI Extractions
CREATE TABLE cw_coi_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES cw_documents(id),
  extracted_json JSONB NOT NULL,
  confidence FLOAT,
  needs_review BOOLEAN DEFAULT false,
  extracted_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_cw_coi_extractions_document_id ON cw_coi_extractions(document_id);

-- Compliance Status
CREATE TABLE cw_compliance_status (
  vendor_id UUID PRIMARY KEY REFERENCES cw_vendors(id),
  status cw_compliance_status_enum NOT NULL DEFAULT 'red',
  reasons_json JSONB DEFAULT '[]'::jsonb,
  next_expiry_date DATE,
  last_checked_at TIMESTAMPTZ DEFAULT now()
);

-- Reminder Log
CREATE TABLE cw_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES cw_vendors(id),
  stage cw_reminder_stage NOT NULL,
  message_preview TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_cw_reminder_log_vendor_id ON cw_reminder_log(vendor_id);
CREATE INDEX idx_cw_reminder_log_sent_at ON cw_reminder_log(sent_at);

-- Requirements Templates
CREATE TABLE cw_requirements_templates (
  trade_type cw_trade_type PRIMARY KEY,
  rules_json JSONB NOT NULL
);

-- Seed 10 vendors
INSERT INTO cw_vendors (name, email, trade_type) VALUES
  ('Acme Construction', 'acme@example.com', 'GC'),
  ('BuildRight Inc', 'buildright@example.com', 'GC'),
  ('Metro General Contractors', 'metro@example.com', 'GC'),
  ('CoolAir HVAC Services', 'coolair@example.com', 'HVAC'),
  ('ProTemp Mechanical', 'protemp@example.com', 'HVAC'),
  ('Apex Plumbing & Electric', 'apex@example.com', 'HVAC'),
  ('SparkClean Janitorial', 'sparkclean@example.com', 'CLEANING'),
  ('GreenEdge Landscaping', 'greenedge@example.com', 'CLEANING'),
  ('PrimeShine Services', 'primeshine@example.com', 'CLEANING'),
  ('AllTrade Maintenance', 'alltrade@example.com', 'GC');

-- Seed 3 requirement templates
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
  }'::jsonb);
