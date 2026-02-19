'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const schema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type FormData = z.infer<typeof schema>;

interface EmailGateProps {
  token: string;
}

export function EmailGate({ token }: EmailGateProps) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setSending(true);
    try {
      // 1. Record the lead
      const gateRes = await fetch(`/api/coi-grader/results/${token}/email-gate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      if (!gateRes.ok) {
        const err = await gateRes.json();
        toast.error(err.error || 'Failed to submit email');
        setSending(false);
        return;
      }

      // 2. Send magic link via Supabase
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/coi-grader/results/${token}`,
        },
      });

      if (error) {
        toast.error('Failed to send magic link. Please try again.');
        setSending(false);
        return;
      }

      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
      setSending(false);
    }
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <CheckCircle className="size-10 text-green-600 dark:text-green-400" />
          <div className="text-center">
            <p className="text-lg font-medium">Check your email</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We sent a magic link to unlock your full compliance report.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-5" />
          Unlock Full Report
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gate-email">Work email</Label>
            <Input
              id="gate-email"
              type="email"
              placeholder="you@company.com"
              {...register('email')}
              disabled={sending}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Unlock Full Report'
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            No password needed — we&apos;ll send you a magic link.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
