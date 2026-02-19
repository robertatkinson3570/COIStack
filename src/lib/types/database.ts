// -------------------------------------------------------
// Enums
// -------------------------------------------------------

export type TradeType = 'GC' | 'HVAC' | 'CLEANING' | 'ELECTRICAL' | 'PLUMBING' | 'ROOFING' | 'LANDSCAPING' | 'OTHER';
export type ComplianceStatusEnum = 'green' | 'yellow' | 'red';
export type ReminderStage = '30d' | '14d' | '7d' | '1d' | 'expired_weekly';
export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type PlanTier = 'starter' | 'growth' | 'pro' | 'scale';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

// -------------------------------------------------------
// Organization & Auth
// -------------------------------------------------------

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_tier: PlanTier;
  subscription_status: SubscriptionStatus;
  vendor_limit: number;
  vendor_count: number;
  trial_ends_at: string | null;
  mfa_enforced: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMembership {
  id: string;
  org_id: string;
  user_id: string;
  role: UserRole;
  invited_by: string | null;
  joined_at: string;
}

export interface Invite {
  id: string;
  org_id: string;
  email: string;
  role: UserRole;
  status: InviteStatus;
  invited_by: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// -------------------------------------------------------
// Core — COI Management
// -------------------------------------------------------

export interface Vendor {
  id: string;
  org_id: string | null;
  name: string;
  email: string | null;
  trade_type: TradeType;
  contact_name: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Document {
  id: string;
  org_id: string | null;
  vendor_id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  checksum: string | null;
  received_at: string;
  source: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface CoiExtractionRow {
  id: string;
  org_id: string | null;
  document_id: string;
  extracted_json: CoiExtractedFields;
  confidence: number | null;
  needs_review: boolean;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  extracted_at: string;
}

export interface ComplianceStatus {
  vendor_id: string;
  org_id: string | null;
  status: ComplianceStatusEnum;
  reasons_json: string[];
  next_expiry_date: string | null;
  last_checked_at: string;
}

export interface ReminderLog {
  id: string;
  org_id: string | null;
  vendor_id: string;
  stage: ReminderStage;
  message_preview: string | null;
  sent_at: string;
}

export interface RequirementsTemplate {
  id?: string;
  org_id: string | null;
  trade_type: TradeType;
  name: string;
  rules_json: ComplianceRules;
  updated_at?: string;
}

// -------------------------------------------------------
// Support
// -------------------------------------------------------

export interface SupportTicket {
  id: string;
  org_id: string;
  user_id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  user_id: string | null;
  is_staff: boolean;
  message: string;
  created_at: string;
}

// -------------------------------------------------------
// Extraction & Compliance
// -------------------------------------------------------

export interface CoiExtractedFields {
  policy_expiration_date: string | null;
  general_liability_each_occurrence: number | null;
  general_liability_aggregate: number | null;
  workers_comp_present: boolean;
  additional_insured_phrase_present: boolean;
  waiver_of_subrogation_phrase_present: boolean;
  // Extended coverage types
  auto_liability_combined_single_limit: number | null;
  umbrella_each_occurrence: number | null;
  umbrella_aggregate: number | null;
  professional_liability_each_occurrence: number | null;
  cyber_liability_each_occurrence: number | null;
  property_insurance_present: boolean;
  // Metadata
  insurer_name: string | null;
  policy_number: string | null;
  named_insured: string | null;
  policy_effective_date: string | null;
  confidence_score: number;
  raw_text_notes: string | null;
}

export interface ComplianceRules {
  gl_each_occurrence_min: number;
  gl_aggregate_min: number;
  workers_comp_required: boolean;
  additional_insured_required: boolean;
  waiver_of_subrogation_required: boolean;
  yellow_days_before_expiry: number;
  // Extended coverage rules (optional — backward compatible with existing templates)
  auto_liability_min?: number;
  umbrella_each_occurrence_min?: number;
  professional_liability_min?: number;
  cyber_liability_min?: number;
  property_insurance_required?: boolean;
}

// -------------------------------------------------------
// Plan Limits
// -------------------------------------------------------

export const PLAN_LIMITS: Record<PlanTier, { vendors: number; teamMembers: number }> = {
  starter: { vendors: 100, teamMembers: 3 },
  growth: { vendors: 250, teamMembers: 10 },
  pro: { vendors: 500, teamMembers: Infinity },
  scale: { vendors: 9999, teamMembers: Infinity },
};

export function getAiMessageLimit(planTier: PlanTier | string): number {
  switch (planTier) {
    case 'growth': return 50;
    case 'pro': return 200;
    case 'scale': return Infinity;
    default: return 0;
  }
}

// -------------------------------------------------------
// V2 Feature Types
// -------------------------------------------------------

export type IntegrationProvider = 'appfolio' | 'yardi' | 'buildium';
export type IntegrationStatus = 'pending' | 'active' | 'error' | 'disabled';
export type IngestStatus = 'matched' | 'unmatched' | 'processed' | 'failed';

export interface VendorPortalLink {
  id: string;
  org_id: string;
  vendor_id: string;
  token: string;
  active: boolean;
  expires_at: string;
  created_at: string;
  created_by: string | null;
}

export interface Integration {
  id: string;
  org_id: string;
  provider: IntegrationProvider;
  api_key_encrypted: string | null;
  status: IntegrationStatus;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationInterest {
  id: string;
  org_id: string;
  provider: IntegrationProvider;
  email: string;
  created_at: string;
}

export interface EmailIngestAddress {
  id: string;
  org_id: string;
  ingest_email: string;
  active: boolean;
  created_at: string;
}

export interface EmailIngestLog {
  id: string;
  org_id: string;
  from_email: string;
  subject: string | null;
  vendor_id_matched: string | null;
  document_id: string | null;
  status: IngestStatus;
  error_message: string | null;
  created_at: string;
}

export interface ComplianceSnapshot {
  id: string;
  org_id: string;
  vendor_id: string;
  status: ComplianceStatusEnum;
  reasons_json: string[];
  snapshot_date: string;
  created_at: string;
}
