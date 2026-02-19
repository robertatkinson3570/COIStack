import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireActiveSubscription } from '@/lib/auth/helpers';

export async function GET(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get('vendor_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const supabase = createServiceClient();

  let query = supabase
    .from('cw_compliance_snapshots')
    .select('*')
    .eq('org_id', context.orgId)
    .order('snapshot_date', { ascending: false })
    .limit(200);

  if (vendorId) {
    query = query.eq('vendor_id', vendorId);
  }

  if (from) {
    query = query.gte('snapshot_date', from);
  }

  if (to) {
    query = query.lte('snapshot_date', to);
  }

  const { data, error: queryError } = await query;

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
