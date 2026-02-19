import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ArrowRight, Clock, Bell, BarChart3 } from 'lucide-react';

export function GraderCta() {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center space-y-6">
      <ShieldCheck className="mx-auto size-10 text-primary" />
      <div>
        <h2 className="font-serif text-xl font-semibold">
          Stop grading one COI at a time
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          COIStack automates compliance monitoring for your entire vendor portfolio.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 text-left">
        <div className="flex items-start gap-2 text-sm">
          <Clock className="size-4 text-primary shrink-0 mt-0.5" />
          <span>Auto-track expirations across all vendors</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <Bell className="size-4 text-primary shrink-0 mt-0.5" />
          <span>Send reminders to vendors automatically</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <BarChart3 className="size-4 text-primary shrink-0 mt-0.5" />
          <span>Portfolio-wide analytics and reporting</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/auth/register">
          <Button size="lg">
            Start Free Trial
            <ArrowRight className="size-4 ml-2" />
          </Button>
        </Link>
        <Link href="/pricing">
          <Button variant="outline" size="lg">View Plans</Button>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        14-day free trial &middot; No credit card required &middot; Starting at $99/mo
      </p>
    </div>
  );
}
