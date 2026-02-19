'use client';

import { GradeBadge } from './grade-badge';
import type { GraderGrade } from '@/lib/grader/types';

interface ResultsSummaryProps {
  grade: GraderGrade;
  passCount: number;
  failCount: number;
  unknownCount: number;
  namedInsured: string | null;
  templateName: string;
}

export function ResultsSummary({
  grade,
  passCount,
  failCount,
  unknownCount,
  namedInsured,
  templateName,
}: ResultsSummaryProps) {
  const total = passCount + failCount + unknownCount;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <GradeBadge grade={grade} />

      <div className="space-y-2">
        <p className="text-lg font-medium">
          {passCount} of {total} checks passed
        </p>
        {namedInsured && (
          <p className="text-sm text-muted-foreground">
            Named Insured: <span className="font-medium text-foreground">{namedInsured}</span>
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Template: {templateName}
        </p>
      </div>
    </div>
  );
}
