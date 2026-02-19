import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/helpers';

export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  const supabase = createServiceClient();

  const { data } = await supabase
    .from('cw_email_ingest_addresses')
    .select('ingest_email, active')
    .eq('org_id', context.orgId)
    .single();

  return NextResponse.json(data ?? { ingest_email: null, active: false });
}
