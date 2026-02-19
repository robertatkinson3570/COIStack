'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ReminderDetail {
  vendor_name: string;
  stage: string;
  message: string;
}

export function ReminderButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    reminders_sent: number;
    details: ReminderDetail[];
  } | null>(null);
  const [open, setOpen] = useState(false);

  async function runReminders() {
    setLoading(true);
    try {
      const res = await fetch('/api/reminders', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Failed to run reminders');
      }
      const data = await res.json();
      setResult({
        reminders_sent: data.reminders_sent ?? 0,
        details: Array.isArray(data.details) ? data.details : [],
      });
      setOpen(true);
    } catch {
      setResult({ reminders_sent: 0, details: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={runReminders} disabled={loading}>
        {loading ? 'Running...' : 'Run Reminders'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Reminder Results ({result?.reminders_sent ?? 0} sent)
            </DialogTitle>
          </DialogHeader>
          {result && result.details.length > 0 ? (
            <div className="space-y-3">
              {result.details.map((d, i) => (
                <div key={i} className="rounded border p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{d.vendor_name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {d.stage}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{d.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No reminders needed at this time.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
