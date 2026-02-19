import { differenceInDays, parseISO } from 'date-fns';
import { CoiExtractedFields, ComplianceRules, ComplianceStatusEnum } from '@/lib/types/database';

export interface ScoreResult {
  status: ComplianceStatusEnum;
  reasons: string[];
  next_expiry_date: string | null;
}

export function scoreCompliance(
  extraction: CoiExtractedFields,
  rule: ComplianceRules,
  today: Date = new Date()
): ScoreResult {
  const reasons: string[] = [];
  let hasRed = false;
  let hasYellow = false;

  // Check expiration
  if (!extraction.policy_expiration_date) {
    reasons.push('Missing expiration date');
    hasRed = true;
  } else {
    const expiry = parseISO(extraction.policy_expiration_date);
    const daysUntil = differenceInDays(expiry, today);

    if (daysUntil < 0) {
      reasons.push(`Policy expired ${Math.abs(daysUntil)} days ago`);
      hasRed = true;
    } else if (daysUntil <= rule.yellow_days_before_expiry) {
      reasons.push(`Policy expires in ${daysUntil} days`);
      hasYellow = true;
    }
  }

  // Check GL each occurrence
  if (extraction.general_liability_each_occurrence === null) {
    reasons.push('Missing GL each occurrence limit');
    hasRed = true;
  } else if (extraction.general_liability_each_occurrence < rule.gl_each_occurrence_min) {
    reasons.push(
      `GL each occurrence $${extraction.general_liability_each_occurrence.toLocaleString()} below minimum $${rule.gl_each_occurrence_min.toLocaleString()}`
    );
    hasRed = true;
  }

  // Check GL aggregate
  if (extraction.general_liability_aggregate === null) {
    reasons.push('Missing GL aggregate limit');
    hasRed = true;
  } else if (extraction.general_liability_aggregate < rule.gl_aggregate_min) {
    reasons.push(
      `GL aggregate $${extraction.general_liability_aggregate.toLocaleString()} below minimum $${rule.gl_aggregate_min.toLocaleString()}`
    );
    hasRed = true;
  }

  // Check workers comp
  if (rule.workers_comp_required && !extraction.workers_comp_present) {
    reasons.push('Workers compensation not present');
    hasRed = true;
  }

  // Check additional insured
  if (rule.additional_insured_required && !extraction.additional_insured_phrase_present) {
    reasons.push('Additional insured language not found');
    hasRed = true;
  }

  // Check waiver of subrogation
  if (rule.waiver_of_subrogation_required && !extraction.waiver_of_subrogation_phrase_present) {
    reasons.push('Waiver of subrogation language not found');
    hasRed = true;
  }

  // Check auto liability
  if (rule.auto_liability_min) {
    if (extraction.auto_liability_combined_single_limit == null) {
      reasons.push('Missing auto liability coverage');
      hasRed = true;
    } else if (extraction.auto_liability_combined_single_limit < rule.auto_liability_min) {
      reasons.push(
        `Auto liability $${extraction.auto_liability_combined_single_limit.toLocaleString()} below minimum $${rule.auto_liability_min.toLocaleString()}`
      );
      hasRed = true;
    }
  }

  // Check umbrella/excess
  if (rule.umbrella_each_occurrence_min) {
    if (extraction.umbrella_each_occurrence == null) {
      reasons.push('Missing umbrella/excess liability coverage');
      hasRed = true;
    } else if (extraction.umbrella_each_occurrence < rule.umbrella_each_occurrence_min) {
      reasons.push(
        `Umbrella each occurrence $${extraction.umbrella_each_occurrence.toLocaleString()} below minimum $${rule.umbrella_each_occurrence_min.toLocaleString()}`
      );
      hasRed = true;
    }
  }

  // Check professional liability
  if (rule.professional_liability_min) {
    if (extraction.professional_liability_each_occurrence == null) {
      reasons.push('Missing professional liability / E&O coverage');
      hasRed = true;
    } else if (extraction.professional_liability_each_occurrence < rule.professional_liability_min) {
      reasons.push(
        `Professional liability $${extraction.professional_liability_each_occurrence.toLocaleString()} below minimum $${rule.professional_liability_min.toLocaleString()}`
      );
      hasRed = true;
    }
  }

  // Check cyber liability
  if (rule.cyber_liability_min) {
    if (extraction.cyber_liability_each_occurrence == null) {
      reasons.push('Missing cyber liability coverage');
      hasRed = true;
    } else if (extraction.cyber_liability_each_occurrence < rule.cyber_liability_min) {
      reasons.push(
        `Cyber liability $${extraction.cyber_liability_each_occurrence.toLocaleString()} below minimum $${rule.cyber_liability_min.toLocaleString()}`
      );
      hasRed = true;
    }
  }

  // Check property insurance
  if (rule.property_insurance_required && !extraction.property_insurance_present) {
    reasons.push('Property insurance not present');
    hasRed = true;
  }

  let status: ComplianceStatusEnum = 'green';
  if (hasRed) status = 'red';
  else if (hasYellow) status = 'yellow';

  return {
    status,
    reasons,
    next_expiry_date: extraction.policy_expiration_date,
  };
}
