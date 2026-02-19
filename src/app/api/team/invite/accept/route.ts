import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { token } = await request.json();
  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Find invite
  const { data: invite, error: inviteError } = await serviceClient
    .from('cw_invites')
    .select('*')
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
  }

  // Check expiry
  if (new Date(invite.expires_at) < new Date()) {
    await serviceClient
      .from('cw_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);

    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 });
  }

  // Verify the invite email matches the authenticated user
  if (invite.email.toLowerCase() !== user.email!.toLowerCase()) {
    return NextResponse.json(
      { error: 'This invite was sent to a different email address' },
      { status: 403 }
    );
  }

  // Check if user is already in an org
  const { data: existingMembership } = await serviceClient
    .from('cw_org_memberships')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (existingMembership) {
    return NextResponse.json(
      { error: 'You already belong to an organization. Leave your current organization first.' },
      { status: 409 }
    );
  }

  // Add membership
  const { error: memberError } = await serviceClient
    .from('cw_org_memberships')
    .insert({
      org_id: invite.org_id,
      user_id: user.id,
      role: invite.role,
      invited_by: invite.invited_by,
    });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  // Mark invite as accepted
  await serviceClient
    .from('cw_invites')
    .update({ status: 'accepted' })
    .eq('id', invite.id);

  return NextResponse.json({ success: true });
}
