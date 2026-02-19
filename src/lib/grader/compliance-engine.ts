import type { CoiExtractedFields } from '@/lib/types/database';
import type { GraderTemplate, GraderCheckResult, GraderComplianceResult, GraderGrade } from './types';

function formatCurrency(amount: number): string {
  return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
}

/**
 * Pure function — grades a COI extraction against a template's requirements.
 * Returns 8 individual check results and an overall grade.
 */
export function gradeCompliance(
  extraction: CoiExtractedFields,
  template: GraderTemplate,
  today: Date = new Date()
): GraderComplianceResult {
  const checks: GraderCheckResult[] = [];

  // 1. Policy Current
  if (!extraction.policy_expiration_date) {
    checks.push({
      id: 'policy_current',
      label: 'Policy Current',
      status: 'fail',
      detail: 'Expiration date not found on certificate',
    });
  } else {
    const expiry = new Date(extraction.policy_expiration_date);
    if (expiry < today) {
      checks.push({
        id: 'policy_current',
        label: 'Policy Current',
        status: 'fail',
        detail: `Policy expired on ${extraction.policy_expiration_date}`,
        actual_value: extraction.policy_expiration_date,
      });
    } else {
      checks.push({
        id: 'policy_current',
        label: 'Policy Current',
        status: 'pass',
        detail: `Policy valid until ${extraction.policy_expiration_date}`,
        actual_value: extraction.policy_expiration_date,
      });
    }
  }

  // 2. GL Each Occurrence
  if (extraction.general_liability_each_occurrence === null) {
    checks.push({
      id: 'gl_each_occurrence',
      label: 'GL Each Occurrence',
      status: 'unknown',
      detail: 'GL each occurrence limit not found',
      required_value: formatCurrency(template.gl_each_occurrence_min),
    });
  } else if (extraction.general_liability_each_occurrence < template.gl_each_occurrence_min) {
    checks.push({
      id: 'gl_each_occurrence',
      label: 'GL Each Occurrence',
      status: 'fail',
      detail: `Limit ${formatCurrency(extraction.general_liability_each_occurrence)} is below required ${formatCurrency(template.gl_each_occurrence_min)}`,
      required_value: formatCurrency(template.gl_each_occurrence_min),
      actual_value: formatCurrency(extraction.general_liability_each_occurrence),
    });
  } else {
    checks.push({
      id: 'gl_each_occurrence',
      label: 'GL Each Occurrence',
      status: 'pass',
      detail: `Limit ${formatCurrency(extraction.general_liability_each_occurrence)} meets minimum ${formatCurrency(template.gl_each_occurrence_min)}`,
      required_value: formatCurrency(template.gl_each_occurrence_min),
      actual_value: formatCurrency(extraction.general_liability_each_occurrence),
    });
  }

  // 3. GL Aggregate
  if (extraction.general_liability_aggregate === null) {
    checks.push({
      id: 'gl_aggregate',
      label: 'GL Aggregate',
      status: 'unknown',
      detail: 'GL aggregate limit not found',
      required_value: formatCurrency(template.gl_aggregate_min),
    });
  } else if (extraction.general_liability_aggregate < template.gl_aggregate_min) {
    checks.push({
      id: 'gl_aggregate',
      label: 'GL Aggregate',
      status: 'fail',
      detail: `Aggregate ${formatCurrency(extraction.general_liability_aggregate)} is below required ${formatCurrency(template.gl_aggregate_min)}`,
      required_value: formatCurrency(template.gl_aggregate_min),
      actual_value: formatCurrency(extraction.general_liability_aggregate),
    });
  } else {
    checks.push({
      id: 'gl_aggregate',
      label: 'GL Aggregate',
      status: 'pass',
      detail: `Aggregate ${formatCurrency(extraction.general_liability_aggregate)} meets minimum ${formatCurrency(template.gl_aggregate_min)}`,
      required_value: formatCurrency(template.gl_aggregate_min),
      actual_value: formatCurrency(extraction.general_liability_aggregate),
    });
  }

  // 4. Workers' Comp
  if (template.workers_comp_required) {
    checks.push({
      id: 'workers_comp',
      label: "Workers' Compensation",
      status: extraction.workers_comp_present ? 'pass' : 'fail',
      detail: extraction.workers_comp_present
        ? "Workers' compensation coverage found"
        : "Workers' compensation not found — required for this template",
    });
  } else {
    checks.push({
      id: 'workers_comp',
      label: "Workers' Compensation",
      status: 'pass',
      detail: 'Not required for this template',
    });
  }

  // 5. Additional Insured
  if (template.additional_insured_required) {
    checks.push({
      id: 'additional_insured',
      label: 'Additional Insured',
      status: extraction.additional_insured_phrase_present ? 'pass' : 'fail',
      detail: extraction.additional_insured_phrase_present
        ? 'Additional insured endorsement found'
        : 'Additional insured language not found — required for this template',
    });
  } else {
    checks.push({
      id: 'additional_insured',
      label: 'Additional Insured',
      status: 'pass',
      detail: 'Not required for this template',
    });
  }

  // 6. Waiver of Subrogation
  if (template.waiver_of_subrogation_required) {
    checks.push({
      id: 'waiver_of_subrogation',
      label: 'Waiver of Subrogation',
      status: extraction.waiver_of_subrogation_phrase_present ? 'pass' : 'fail',
      detail: extraction.waiver_of_subrogation_phrase_present
        ? 'Waiver of subrogation found'
        : 'Waiver of subrogation not found — required for this template',
    });
  } else {
    checks.push({
      id: 'waiver_of_subrogation',
      label: 'Waiver of Subrogation',
      status: 'pass',
      detail: 'Not required for this template',
    });
  }

  // 7. Auto Liability
  if (extraction.auto_liability_combined_single_limit != null) {
    checks.push({
      id: 'auto_liability',
      label: 'Auto Liability',
      status: 'pass',
      detail: `Auto liability combined single limit ${formatCurrency(extraction.auto_liability_combined_single_limit)} found`,
      actual_value: formatCurrency(extraction.auto_liability_combined_single_limit),
    });
  } else {
    checks.push({
      id: 'auto_liability',
      label: 'Auto Liability',
      status: 'unknown',
      detail: 'Auto liability coverage not found on this certificate',
    });
  }

  // 8. Umbrella / Excess
  if (extraction.umbrella_each_occurrence != null) {
    checks.push({
      id: 'umbrella_excess',
      label: 'Umbrella / Excess',
      status: 'pass',
      detail: `Umbrella each occurrence ${formatCurrency(extraction.umbrella_each_occurrence)} found`,
      actual_value: formatCurrency(extraction.umbrella_each_occurrence),
    });
  } else {
    checks.push({
      id: 'umbrella_excess',
      label: 'Umbrella / Excess',
      status: 'unknown',
      detail: 'Umbrella/excess coverage not found on this certificate',
    });
  }

  // 9. Professional Liability
  if (extraction.professional_liability_each_occurrence != null) {
    checks.push({
      id: 'professional_liability',
      label: 'Professional Liability / E&O',
      status: 'pass',
      detail: `Professional liability ${formatCurrency(extraction.professional_liability_each_occurrence)} found`,
      actual_value: formatCurrency(extraction.professional_liability_each_occurrence),
    });
  } else {
    checks.push({
      id: 'professional_liability',
      label: 'Professional Liability / E&O',
      status: 'unknown',
      detail: 'Professional liability not found on this certificate',
    });
  }

  // 10. Cyber Liability
  if (extraction.cyber_liability_each_occurrence != null) {
    checks.push({
      id: 'cyber_liability',
      label: 'Cyber Liability',
      status: extraction.cyber_liability_each_occurrence > 0 ? 'pass' : 'unknown',
      detail: extraction.cyber_liability_each_occurrence > 0
        ? `Cyber liability ${formatCurrency(extraction.cyber_liability_each_occurrence)} found`
        : 'Cyber liability not found on this certificate',
      actual_value: extraction.cyber_liability_each_occurrence > 0 ? formatCurrency(extraction.cyber_liability_each_occurrence) : undefined,
    });
  } else {
    checks.push({
      id: 'cyber_liability',
      label: 'Cyber Liability',
      status: 'unknown',
      detail: 'Cyber liability not found on this certificate',
    });
  }

  // 11. Property Insurance
  checks.push({
    id: 'property_insurance',
    label: 'Property Insurance',
    status: extraction.property_insurance_present ? 'pass' : 'unknown',
    detail: extraction.property_insurance_present
      ? 'Property insurance coverage found'
      : 'Property insurance not found on this certificate',
  });

  // Calculate counts
  const pass_count = checks.filter((c) => c.status === 'pass').length;
  const fail_count = checks.filter((c) => c.status === 'fail').length;
  const unknown_count = checks.filter((c) => c.status === 'unknown').length;

  // Determine overall grade
  let overall_grade: GraderGrade;
  if (fail_count > 0) {
    overall_grade = 'NON_COMPLIANT';
  } else if (unknown_count > 0) {
    overall_grade = 'AT_RISK';
  } else {
    overall_grade = 'COMPLIANT';
  }

  return { overall_grade, checks, pass_count, fail_count, unknown_count };
}
