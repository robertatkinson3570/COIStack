import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole } from '@/lib/auth/helpers';

export async function GET(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const roleError = requireRole(context, ['owner', 'admin']);
  if (roleError) return roleError;

  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 50, 100);
  const offset = Number(request.nextUrl.searchParams.get('offset')) || 0;
  const action = request.nextUrl.searchParams.get('action');

  const supabase = createServiceClient();

  let query = supabase
    .from('cw_audit_log')
    .select('*', { count: 'exact' })
    .eq('org_id', context.orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (action) {
    query = query.eq('action', action);
  }

  const { data, error: dbError, count } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [], total: count ?? 0 });
}
