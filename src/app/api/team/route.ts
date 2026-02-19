import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireActiveSubscription } from '@/lib/auth/helpers';

export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const supabase = createServiceClient();

  // Get members with profiles
  const { data: memberships, error: memberError } = await supabase
    .from('cw_org_memberships')
    .select('*, cw_user_profiles(*)')
    .eq('org_id', context.orgId)
    .order('joined_at');

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // Get pending invites
  const { data: invites, error: inviteError } = await supabase
    .from('cw_invites')
    .select('*')
    .eq('org_id', context.orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  const members = (memberships || []).map((m) => ({
    id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    full_name: (m.cw_user_profiles as { full_name: string } | null)?.full_name ?? '',
    email: (m.cw_user_profiles as { email: string } | null)?.email ?? '',
    avatar_url: (m.cw_user_profiles as { avatar_url: string | null } | null)?.avatar_url ?? null,
  }));

  return NextResponse.json({ members, invites: invites || [] });
}
