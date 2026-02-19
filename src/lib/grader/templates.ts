import type { GraderTemplate, GraderTemplateKey } from './types';

export const GRADER_TEMPLATES: Record<GraderTemplateKey, GraderTemplate> = {
  standard_commercial: {
    key: 'standard_commercial',
    name: 'Standard Commercial',
    description: 'General commercial vendor requirements',
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
  },
  general_contractor: {
    key: 'general_contractor',
    name: 'General Contractor',
    description: 'Contractor and subcontractor requirements',
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
  },
  hvac_trades: {
    key: 'hvac_trades',
    name: 'HVAC & Trades',
    description: 'HVAC, electrical, plumbing, and similar trades',
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
  },
  cleaning_landscaping: {
    key: 'cleaning_landscaping',
    name: 'Cleaning & Landscaping',
    description: 'Cleaning, janitorial, and landscaping services',
    gl_each_occurrence_min: 1_000_000,
    gl_aggregate_min: 2_000_000,
    workers_comp_required: true,
    additional_insured_required: false,
    waiver_of_subrogation_required: false,
  },
};

export function getTemplate(key: GraderTemplateKey): GraderTemplate {
  return GRADER_TEMPLATES[key];
}

export function isValidTemplateKey(key: string): key is GraderTemplateKey {
  return key in GRADER_TEMPLATES;
}
