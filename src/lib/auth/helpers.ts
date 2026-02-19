import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { UserRole, Organization, OrgMembership } from '@/lib/types/database';

interface AuthContext {
  user: { id: string; email: string };
  orgId: string;
  role: UserRole;
  org: Organization;
}

/**
 * Validates that the request is from an authenticated user and returns their auth context.
 * Returns null and a 401 response if not authenticated.
 */
export async function requireAuth(): Promise<
  { context: AuthContext; error: null } | { context: null; error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    if (authError) console.error('[auth] getUser error:', authError.message);
    return {
      context: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  // Get user's org membership using service client (bypasses RLS)
  const serviceClient = createServiceClient();
  const { data: membership, error: memberError } = await serviceClient
    .from('cw_org_memberships')
    .select('*, cw_organizations(*)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (memberError || !membership) {
    return {
      context: null,
      error: NextResponse.json({ error: 'No organization found' }, { status: 403 }),
    };
  }

  return {
    context: {
      user: { id: user.id, email: user.email! },
      orgId: membership.org_id,
      role: membership.role as UserRole,
      org: membership.cw_organizations as Organization,
    },
    error: null,
  };
}

/**
 * Checks whether an org has an active subscription or valid trial.
 * Returns true if the org can use paid features.
 */
export function isSubscriptionActive(org: Organization): boolean {
  const status = org.subscription_status;

  // Active or past_due (grace period) subscriptions are allowed
  if (status === 'active' || status === 'past_due') return true;

  // Trialing — check if trial hasn't expired
  if (status === 'trialing') {
    if (!org.trial_ends_at) return true; // No end date set = unlimited trial
    return new Date(org.trial_ends_at) > new Date();
  }

  // canceled, incomplete, or any other status = not active
  return false;
}

/**
 * Checks that the org has an active subscription or valid trial.
 * Returns a 402 response if subscription is expired.
 * Exempt routes (billing, support) should NOT call this.
 */
export function requireActiveSubscription(context: AuthContext): NextResponse | null {
  if (!isSubscriptionActive(context.org)) {
    return NextResponse.json(
      {
        error: 'Subscription expired',
        code: 'SUBSCRIPTION_EXPIRED',
        upgrade_url: '/settings/billing',
      },
      { status: 402 }
    );
  }
  return null;
}

/**
 * Checks that the authenticated user has one of the required roles.
 */
export function requireRole(
  context: AuthContext,
  allowedRoles: UserRole[]
): NextResponse | null {
  if (!allowedRoles.includes(context.role)) {
    return NextResponse.json(
      { error: `Forbidden: requires ${allowedRoles.join(' or ')} role` },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Ensures a user profile exists in cw_user_profiles.
 * Called during registration since we don't rely on a database trigger.
 * Uses the service role client to bypass RLS.
 */
export async function ensureUserProfile(
  userId: string,
  email: string,
  fullName: string
): Promise<{ error: string | null }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('cw_user_profiles')
    .upsert(
      { id: userId, email, full_name: fullName },
      { onConflict: 'id' }
    );

  return { error: error?.message ?? null };
}

/**
 * Creates a new organization and membership for a user during registration.
 * Uses the service role client to bypass RLS.
 */
export async function createOrganization(
  userId: string,
  companyName: string
): Promise<{ orgId: string } | { error: string }> {
  const supabase = createServiceClient();

  // Generate slug from company name
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  // Check for slug uniqueness, append random suffix if needed
  const { data: existing } = await supabase
    .from('cw_organizations')
    .select('id')
    .eq('slug', slug)
    .single();

  const finalSlug = existing
    ? `${slug}-${Math.random().toString(36).substring(2, 6)}`
    : slug;

  // Create the organization
  const { data: org, error: orgError } = await supabase
    .from('cw_organizations')
    .insert({
      name: companyName,
      slug: finalSlug,
    })
    .select()
    .single();

  if (orgError || !org) {
    return { error: orgError?.message || 'Failed to create organization' };
  }

  // Create membership as owner
  const { error: memberError } = await supabase.from('cw_org_memberships').insert({
    org_id: org.id,
    user_id: userId,
    role: 'owner',
  });

  if (memberError) {
    return { error: memberError.message };
  }

  // Create default requirement templates for all trade types
  const defaultTradeTypes = ['GC', 'HVAC', 'CLEANING', 'ELECTRICAL', 'PLUMBING', 'ROOFING', 'LANDSCAPING', 'OTHER'];

  const defaultRules = {
    gl_each_occurrence_min: 1000000,
    gl_aggregate_min: 2000000,
    workers_comp_required: true,
    additional_insured_required: true,
    waiver_of_subrogation_required: true,
    yellow_days_before_expiry: 30,
    auto_liability_min: 1000000,
  };

  // GC gets umbrella requirement
  const gcRules = {
    ...defaultRules,
    umbrella_each_occurrence_min: 5000000,
  };

  const cleaningRules = {
    ...defaultRules,
    additional_insured_required: false,
    waiver_of_subrogation_required: false,
    auto_liability_min: undefined,
  };

  const templates = defaultTradeTypes.map((trade) => ({
    org_id: org.id,
    trade_type: trade,
    name: `${trade} Default`,
    rules_json: trade === 'GC' ? gcRules : trade === 'CLEANING' ? cleaningRules : defaultRules,
  }));

  await supabase.from('cw_requirements_templates').insert(templates);

  return { orgId: org.id };
}
