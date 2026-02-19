import type { CoiExtractedFields } from '@/lib/types/database';

// -------------------------------------------------------
// Template & Grade enums
// -------------------------------------------------------

export type GraderTemplateKey =
  | 'standard_commercial'
  | 'general_contractor'
  | 'hvac_trades'
  | 'cleaning_landscaping';

export type GraderGrade = 'COMPLIANT' | 'AT_RISK' | 'NON_COMPLIANT';

export type GraderCheckStatus = 'pass' | 'fail' | 'unknown';

// -------------------------------------------------------
// Compliance engine types
// -------------------------------------------------------

export interface GraderCheckResult {
  id: string;
  label: string;
  status: GraderCheckStatus;
  detail: string;
  required_value?: string;
  actual_value?: string;
}

export interface GraderComplianceResult {
  overall_grade: GraderGrade;
  checks: GraderCheckResult[];
  pass_count: number;
  fail_count: number;
  unknown_count: number;
}

// -------------------------------------------------------
// Template definition
// -------------------------------------------------------

export interface GraderTemplate {
  key: GraderTemplateKey;
  name: string;
  description: string;
  gl_each_occurrence_min: number;
  gl_aggregate_min: number;
  workers_comp_required: boolean;
  additional_insured_required: boolean;
  waiver_of_subrogation_required: boolean;
}

// -------------------------------------------------------
// DB row types
// -------------------------------------------------------

export interface GraderUploadRow {
  id: string;
  public_token: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  ip_hash: string;
  template_key: GraderTemplateKey;
  status: 'processing' | 'completed' | 'failed';
  error_message: string | null;
  expires_at: string;
  created_at: string;
}

export interface GraderResultRow {
  id: string;
  upload_id: string;
  extracted_json: CoiExtractedFields;
  confidence: number | null;
  overall_grade: GraderGrade;
  checks_json: GraderCheckResult[];
  pass_count: number;
  fail_count: number;
  unknown_count: number;
  email_unlocked: boolean;
  unlocked_by_user_id: string | null;
  unlocked_at: string | null;
  created_at: string;
}

export interface LeadCaptureRow {
  id: string;
  email: string;
  upload_id: string | null;
  user_id: string | null;
  source: string;
  created_at: string;
}

// -------------------------------------------------------
// API response types
// -------------------------------------------------------

export interface GraderUploadResponse {
  token: string;
  status: 'processing' | 'completed' | 'failed';
  overall_grade: GraderGrade;
}

export interface GraderResultsResponse {
  overall_grade: GraderGrade;
  pass_count: number;
  fail_count: number;
  unknown_count: number;
  named_insured: string | null;
  template_name: string;
  email_unlocked: boolean;
  // Gated fields — only present when email_unlocked is true
  checks?: GraderCheckResult[];
  extracted_fields?: CoiExtractedFields;
  confidence?: number | null;
}
