'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/hooks/use-user';

/** Routes that remain accessible even when the subscription is expired */
const EXEMPT_PATHS = ['/settings/billing', '/support', '/settings/profile'];

function isExpired(status: string | undefined, trialEndsAt: string | null | undefined): boolean {
  if (!status) return false;

  if (status === 'active' || status === 'past_due') return false;

  if (status === 'trialing') {
    if (!trialEndsAt) return false;
    return new Date(trialEndsAt) <= new Date();
  }

  // canceled, incomplete, or any other status
  return true;
}

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { org, loading } = useUser();
  const pathname = usePathname();

  // Don't block while loading or on exempt paths
  if (loading) return <>{children}</>;
  if (EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return <>{children}</>;

  // Check subscription
  if (org && isExpired(org.subscription_status, org.trial_ends_at)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <div className="rounded-2xl border bg-card p-8 shadow-sm max-w-md w-full">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <AlertTriangle className="size-6 text-yellow-600 dark:text-yellow-400" />
          </div>

          <h2 className="font-serif text-xl font-semibold">
            {org.subscription_status === 'canceled'
              ? 'Subscription Canceled'
              : 'Trial Expired'}
          </h2>

          <p className="mt-3 text-sm text-muted-foreground">
            {org.subscription_status === 'canceled'
              ? 'Your subscription has been canceled. Upgrade to regain access to your compliance dashboard, vendor management, and all COIStack features.'
              : 'Your 14-day free trial has ended. Choose a plan to continue monitoring vendor insurance compliance.'}
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <Link href="/settings/billing">
              <Button className="w-full" size="lg">
                <CreditCard className="mr-2 size-4" />
                Upgrade Now
              </Button>
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            Your data is safe. Upgrade anytime to pick up where you left off.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
