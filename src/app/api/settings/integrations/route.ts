import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireActiveSubscription } from '@/lib/auth/helpers';

export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const supabase = createServiceClient();

  const { data: integrations } = await supabase
    .from('cw_integrations')
    .select('*')
    .eq('org_id', context.orgId);

  const { data: interests } = await supabase
    .from('cw_integration_interest')
    .select('provider')
    .eq('org_id', context.orgId);

  const { data: ingestAddress } = await supabase
    .from('cw_email_ingest_addresses')
    .select('ingest_email, active')
    .eq('org_id', context.orgId)
    .single();

  return NextResponse.json({
    integrations: integrations ?? [],
    interests: (interests ?? []).map((i) => i.provider),
    email_ingest: ingestAddress ?? null,
  });
}
