import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/helpers';

export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  return NextResponse.json({
    plan_tier: context.org.plan_tier,
    subscription_status: context.org.subscription_status,
    vendor_limit: context.org.vendor_limit,
    vendor_count: context.org.vendor_count,
    trial_ends_at: context.org.trial_ends_at,
  });
}
