import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceClient = createServiceClient();

  // Fetch profile and org membership in parallel using service client (bypasses RLS)
  const [profileRes, membershipRes] = await Promise.all([
    serviceClient
      .from('cw_user_profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    serviceClient
      .from('cw_org_memberships')
      .select('*, cw_organizations(*)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .single(),
  ]);

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    profile: profileRes.data ?? null,
    org: membershipRes.data?.cw_organizations ?? null,
    role: membershipRes.data?.role ?? null,
  });
}
