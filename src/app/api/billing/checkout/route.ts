import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole } from '@/lib/auth/helpers';
import { getStripe, getPriceIdForTier } from '@/lib/stripe';
import type { PlanTier } from '@/lib/types/database';

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const roleError = requireRole(context, ['owner']);
  if (roleError) return roleError;

  const { tier } = (await request.json()) as { tier: PlanTier };
  const priceId = getPriceIdForTier(tier);

  if (!priceId) {
    return NextResponse.json({ error: 'Invalid plan tier or price not configured' }, { status: 400 });
  }

  const stripe = getStripe();
  const supabase = createServiceClient();

  // Create or retrieve Stripe customer
  let customerId = context.org.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: context.user.email,
      metadata: { org_id: context.orgId },
    });
    customerId = customer.id;

    await supabase
      .from('cw_organizations')
      .update({ stripe_customer_id: customerId })
      .eq('id', context.orgId);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: context.org.subscription_status === 'trialing' ? undefined : 14,
      metadata: { org_id: context.orgId },
    },
    success_url: `${appUrl}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { org_id: context.orgId },
  });

  return NextResponse.json({ url: session.url });
}
