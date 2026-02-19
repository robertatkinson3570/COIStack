import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/helpers';
import { getStripe } from '@/lib/stripe';

export async function POST() {
  const { context, error } = await requireAuth();
  if (error) return error;

  const roleError = requireRole(context, ['owner']);
  if (roleError) return roleError;

  if (!context.org.stripe_customer_id) {
    return NextResponse.json(
      { error: 'No billing account found. Please select a plan first.' },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const session = await stripe.billingPortal.sessions.create({
    customer: context.org.stripe_customer_id,
    return_url: `${appUrl}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
