'use client';

import { CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import type { GraderCheckResult } from '@/lib/grader/types';
import { cn } from '@/lib/utils';

const statusConfig = {
  pass: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400' },
  fail: { icon: XCircle, color: 'text-red-600 dark:text-red-400' },
  unknown: { icon: HelpCircle, color: 'text-yellow-600 dark:text-yellow-400' },
};

interface CheckScorecardProps {
  checks: GraderCheckResult[];
}

export function CheckScorecard({ checks }: CheckScorecardProps) {
  return (
    <div className="space-y-2">
      {checks.map((check) => {
        const config = statusConfig[check.status];
        const Icon = config.icon;
        return (
          <div
            key={check.id}
            className="flex items-center gap-3 rounded-lg border px-4 py-3"
          >
            <Icon className={cn('size-5 shrink-0', config.color)} />
            <span className="text-sm font-medium">{check.label}</span>
          </div>
        );
      })}
    </div>
  );
}
