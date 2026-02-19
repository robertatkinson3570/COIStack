import Stripe from 'stripe';
import type { PlanTier } from '@/lib/types/database';

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY');

  stripeInstance = new Stripe(key, { apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion });
  return stripeInstance;
}

export function getPriceIdForTier(tier: PlanTier): string | null {
  const map: Record<PlanTier, string | undefined> = {
    starter: process.env.STRIPE_STARTER_PRICE_ID,
    growth: process.env.STRIPE_GROWTH_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID,
    scale: process.env.STRIPE_SCALE_PRICE_ID,
  };
  return map[tier] || null;
}

export function getTierForPriceId(priceId: string): PlanTier {
  if (priceId === process.env.STRIPE_GROWTH_PRICE_ID) return 'growth';
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'pro';
  if (priceId === process.env.STRIPE_SCALE_PRICE_ID) return 'scale';
  return 'starter';
}

export function getVendorLimitForTier(tier: PlanTier): number {
  const limits: Record<PlanTier, number> = {
    starter: 100,
    growth: 250,
    pro: 500,
    scale: 9999,
  };
  return limits[tier];
}
