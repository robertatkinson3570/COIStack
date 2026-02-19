'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UploadResult } from './upload-form';
import { CoiExtractedFields } from '@/lib/types/database';

interface ExtractionResultProps {
  result: UploadResult;
}

const statusColors: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

function formatCurrency(value: number | null): string {
  if (value === null) return 'N/A';
  return `$${value.toLocaleString()}`;
}

export function ExtractionResult({ result }: ExtractionResultProps) {
  const fields = result.extracted_json as unknown as CoiExtractedFields;

  return (
    <div className="space-y-4">
      {/* Compliance Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Compliance Result</CardTitle>
            <Badge
              className={`${statusColors[result.compliance.status]} text-white text-sm px-3 py-1`}
            >
              {result.compliance.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {result.compliance.reasons.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {result.compliance.reasons.map((reason, i) => (
                <li key={i} className="text-muted-foreground">
                  - {reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-600 dark:text-green-400">All requirements met.</p>
          )}

          {result.needs_review && (
            <p className="mt-2 text-sm font-medium text-yellow-600 dark:text-yellow-400">
              Flagged for manual review
            </p>
          )}

          {result.diff?.has_regression && (
            <div className="mt-2 rounded bg-destructive/10 p-2">
              <p className="text-sm font-medium text-destructive">Regression Detected:</p>
              <ul className="text-sm text-destructive/80">
                {result.diff.regressions.map((r, i) => (
                  <li key={i}>- {r}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted Fields */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Extracted Fields</CardTitle>
            <span className="text-sm text-muted-foreground">
              Confidence: {(result.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Expiration Date</span>
              <p className="font-medium">{fields.policy_expiration_date ?? 'Not found'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Effective Date</span>
              <p className="font-medium">{fields.policy_effective_date ?? 'Not found'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">GL Each Occurrence</span>
              <p className="font-medium">{formatCurrency(fields.general_liability_each_occurrence)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">GL Aggregate</span>
              <p className="font-medium">{formatCurrency(fields.general_liability_aggregate)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Workers Comp</span>
              <p className="font-medium">{fields.workers_comp_present ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Additional Insured</span>
              <p className="font-medium">{fields.additional_insured_phrase_present ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Waiver of Subrogation</span>
              <p className="font-medium">{fields.waiver_of_subrogation_phrase_present ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Insurer</span>
              <p className="font-medium">{fields.insurer_name ?? 'Not found'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Policy Number</span>
              <p className="font-medium">{fields.policy_number ?? 'Not found'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Named Insured</span>
              <p className="font-medium">{fields.named_insured ?? 'Not found'}</p>
            </div>
          </div>

          {fields.raw_text_notes && (
            <div className="mt-3 rounded bg-muted p-2">
              <p className="text-xs text-muted-foreground">{fields.raw_text_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
