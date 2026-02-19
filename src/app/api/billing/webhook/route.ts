import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getStripe, getTierForPriceId, getVendorLimitForTier } from '@/lib/stripe';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown'}` },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.org_id;
      if (!orgId) break;

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );
      const priceId = subscription.items.data[0]?.price?.id;
      const tier = priceId ? getTierForPriceId(priceId) : 'starter';

      await supabase
        .from('cw_organizations')
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plan_tier: tier,
          subscription_status: subscription.status === 'trialing' ? 'trialing' : 'active',
          vendor_limit: getVendorLimitForTier(tier),
        })
        .eq('id', orgId);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.org_id;
      if (!orgId) break;

      const priceId = subscription.items.data[0]?.price?.id;
      const tier = priceId ? getTierForPriceId(priceId) : 'starter';

      const statusMap: Record<string, string> = {
        trialing: 'trialing',
        active: 'active',
        past_due: 'past_due',
        canceled: 'canceled',
        incomplete: 'incomplete',
      };

      await supabase
        .from('cw_organizations')
        .update({
          plan_tier: tier,
          subscription_status: statusMap[subscription.status] || 'active',
          vendor_limit: getVendorLimitForTier(tier),
        })
        .eq('id', orgId);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const orgId = subscription.metadata?.org_id;
      if (!orgId) break;

      await supabase
        .from('cw_organizations')
        .update({
          subscription_status: 'canceled',
          plan_tier: 'starter',
          vendor_limit: getVendorLimitForTier('starter'),
        })
        .eq('id', orgId);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as unknown as { subscription?: string }).subscription;
      if (!subscriptionId) break;

      await supabase
        .from('cw_organizations')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_subscription_id', subscriptionId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
