import { CoiExtractedFields } from '@/lib/types/database';

export interface DiffResult {
  has_regression: boolean;
  regressions: string[];
}

/**
 * Compare a new extraction against the previous one for the same vendor.
 * Flags regressions: limit decreases, phrase flag disappearances.
 */
export function diffExtractions(
  current: CoiExtractedFields,
  previous: CoiExtractedFields | null
): DiffResult {
  if (!previous) {
    return { has_regression: false, regressions: [] };
  }

  const regressions: string[] = [];

  // Check GL each occurrence regression
  if (
    previous.general_liability_each_occurrence !== null &&
    current.general_liability_each_occurrence !== null &&
    current.general_liability_each_occurrence < previous.general_liability_each_occurrence
  ) {
    regressions.push(
      `GL each occurrence decreased from $${previous.general_liability_each_occurrence.toLocaleString()} to $${current.general_liability_each_occurrence.toLocaleString()}`
    );
  }

  // Check GL aggregate regression
  if (
    previous.general_liability_aggregate !== null &&
    current.general_liability_aggregate !== null &&
    current.general_liability_aggregate < previous.general_liability_aggregate
  ) {
    regressions.push(
      `GL aggregate decreased from $${previous.general_liability_aggregate.toLocaleString()} to $${current.general_liability_aggregate.toLocaleString()}`
    );
  }

  // Check workers comp regression
  if (previous.workers_comp_present && !current.workers_comp_present) {
    regressions.push('Workers compensation coverage removed');
  }

  // Check additional insured regression
  if (previous.additional_insured_phrase_present && !current.additional_insured_phrase_present) {
    regressions.push('Additional insured language removed');
  }

  // Check waiver of subrogation regression
  if (previous.waiver_of_subrogation_phrase_present && !current.waiver_of_subrogation_phrase_present) {
    regressions.push('Waiver of subrogation language removed');
  }

  return {
    has_regression: regressions.length > 0,
    regressions,
  };
}
