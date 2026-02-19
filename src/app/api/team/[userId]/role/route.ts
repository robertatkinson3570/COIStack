import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole } from '@/lib/auth/helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const roleError = requireRole(context, ['owner']);
  if (roleError) return roleError;

  const { userId } = await params;
  const { role } = await request.json();

  if (!role || !['admin', 'member', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Can't change your own role
  if (userId === context.user.id) {
    return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error: updateError } = await supabase
    .from('cw_org_memberships')
    .update({ role })
    .eq('org_id', context.orgId)
    .eq('user_id', userId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
