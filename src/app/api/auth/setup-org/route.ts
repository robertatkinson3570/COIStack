import { createClient } from '@/lib/supabase/server';
import { createOrganization, ensureUserProfile } from '@/lib/auth/helpers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyName, fullName } = await request.json();

  if (!companyName || typeof companyName !== 'string' || companyName.length < 2) {
    return NextResponse.json(
      { error: 'Company name must be at least 2 characters' },
      { status: 400 }
    );
  }

  // Ensure user profile exists (does not rely on DB trigger)
  const profileResult = await ensureUserProfile(
    user.id,
    user.email!,
    fullName || user.user_metadata?.full_name || ''
  );

  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error }, { status: 500 });
  }

  // Check if user already has an org
  const { data: existingMembership } = await supabase
    .from('cw_org_memberships')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (existingMembership) {
    return NextResponse.json({ error: 'User already belongs to an organization' }, { status: 409 });
  }

  const result = await createOrganization(user.id, companyName);

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ orgId: result.orgId });
}
