import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole } from '@/lib/auth/helpers';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const roleError = requireRole(context, ['owner', 'admin']);
  if (roleError) return roleError;

  const { id } = await params;
  const supabase = createServiceClient();

  const { error: updateError } = await supabase
    .from('cw_invites')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('org_id', context.orgId)
    .eq('status', 'pending');

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
