'use client';

import { CheckCircle, XCircle, HelpCircle, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GraderCheckResult } from '@/lib/grader/types';
import { cn } from '@/lib/utils';

const statusConfig = {
  pass: { icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
  fail: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  unknown: { icon: HelpCircle, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
};

interface CheckDetailsProps {
  checks: GraderCheckResult[] | undefined;
  locked: boolean;
}

export function CheckDetails({ checks, locked }: CheckDetailsProps) {
  if (locked || !checks) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader>
          <CardTitle>Detailed Results</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Blurred placeholder */}
          <div className="space-y-3 blur-sm select-none" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
                <div className="size-5 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-48 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
          {/* Lock overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <Lock className="mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Unlock with your email to see full details</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detailed Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {checks.map((check) => {
          const config = statusConfig[check.status];
          const Icon = config.icon;
          return (
            <div
              key={check.id}
              className={cn('flex items-start gap-3 rounded-lg p-4', config.bg)}
            >
              <Icon className={cn('mt-0.5 size-5 shrink-0', config.color)} />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{check.label}</p>
                <p className="text-sm text-muted-foreground">{check.detail}</p>
                {(check.required_value || check.actual_value) && (
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {check.required_value && <span>Required: {check.required_value}</span>}
                    {check.actual_value && <span>Found: {check.actual_value}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
