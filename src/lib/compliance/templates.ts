import { ComplianceRules, TradeType } from '@/lib/types/database';

/**
 * Hardcoded compliance rule templates.
 * These mirror the DB seed data and serve as a typed fallback.
 */
export const COMPLIANCE_TEMPLATES: Record<TradeType, ComplianceRules> = {
  GC: {
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
    yellow_days_before_expiry: 30,
  },
  HVAC: {
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
    yellow_days_before_expiry: 30,
  },
  CLEANING: {
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: false,
    waiver_of_subrogation_required: false,
    yellow_days_before_expiry: 30,
  },
  ELECTRICAL: {
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
    yellow_days_before_expiry: 30,
  },
  PLUMBING: {
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
    yellow_days_before_expiry: 30,
  },
  ROOFING: {
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
    yellow_days_before_expiry: 30,
  },
  LANDSCAPING: {
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
    yellow_days_before_expiry: 30,
  },
  OTHER: {
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
    yellow_days_before_expiry: 30,
  },
};
