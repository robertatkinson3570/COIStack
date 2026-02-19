'use client';

import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ComplianceSnapshot } from '@/lib/types/database';

interface HistoryTimelineProps {
  snapshots: ComplianceSnapshot[];
}

const statusColors: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  green: 'Compliant',
  yellow: 'Expiring Soon',
  red: 'Non-Compliant',
};

export function HistoryTimeline({ snapshots }: HistoryTimelineProps) {
  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No compliance history available yet.
      </p>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-border" />

      {snapshots.map((snapshot, index) => (
        <div key={snapshot.id} className="relative flex items-start gap-4 py-2">
          {/* Status dot */}
          <div
            className={cn(
              'relative z-10 mt-1 size-5 rounded-full border-2 border-background',
              statusColors[snapshot.status] ?? 'bg-gray-500'
            )}
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {statusLabels[snapshot.status] ?? snapshot.status}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(snapshot.snapshot_date), 'MMM d, yyyy')}
              </span>
            </div>

            {Array.isArray(snapshot.reasons_json) && snapshot.reasons_json.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {snapshot.reasons_json.map((reason, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
