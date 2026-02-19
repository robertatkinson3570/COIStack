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
