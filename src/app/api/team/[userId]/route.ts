import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole } from '@/lib/auth/helpers';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const roleError = requireRole(context, ['owner']);
  if (roleError) return roleError;

  const { userId } = await params;

  if (userId === context.user.id) {
    return NextResponse.json({ error: "You can't remove yourself" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error: deleteError } = await supabase
    .from('cw_org_memberships')
    .delete()
    .eq('org_id', context.orgId)
    .eq('user_id', userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
