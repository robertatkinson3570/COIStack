import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole, requireActiveSubscription } from '@/lib/auth/helpers';
import { PLAN_LIMITS } from '@/lib/types/database';

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const roleError = requireRole(context, ['owner', 'admin']);
  if (roleError) return roleError;

  const supabase = createServiceClient();
  const { email, role } = await request.json();

  if (!email || !role) {
    return NextResponse.json({ error: 'email and role are required' }, { status: 400 });
  }

  // Check team member limit
  const { count: memberCount } = await supabase
    .from('cw_org_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', context.orgId);

  const limit = PLAN_LIMITS[context.org.plan_tier].teamMembers;
  if ((memberCount ?? 0) >= limit) {
    return NextResponse.json(
      { error: `Team member limit reached (${limit}). Upgrade your plan to invite more members.` },
      { status: 403 }
    );
  }

  // Check no existing pending invite
  const { data: existing } = await supabase
    .from('cw_invites')
    .select('id')
    .eq('org_id', context.orgId)
    .eq('email', email)
    .eq('status', 'pending')
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'A pending invite already exists for this email' }, { status: 409 });
  }

  // Check no existing membership
  const { data: existingMember } = await supabase
    .from('cw_user_profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (existingMember) {
    const { data: membership } = await supabase
      .from('cw_org_memberships')
      .select('id')
      .eq('org_id', context.orgId)
      .eq('user_id', existingMember.id)
      .single();

    if (membership) {
      return NextResponse.json({ error: 'This user is already a member of your organization' }, { status: 409 });
    }
  }

  // Restrict role assignment (non-owners can't invite admins)
  if (role === 'owner') {
    return NextResponse.json({ error: 'Cannot invite as owner' }, { status: 400 });
  }
  if (role === 'admin' && context.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can invite admins' }, { status: 403 });
  }

  const { data: invite, error: insertError } = await supabase
    .from('cw_invites')
    .insert({
      org_id: context.orgId,
      email,
      role,
      invited_by: context.user.id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const inviteUrl = `${appUrl}/auth/register?invite=${invite.token}`;

  return NextResponse.json({
    invite,
    invite_url: inviteUrl,
  }, { status: 201 });
}
