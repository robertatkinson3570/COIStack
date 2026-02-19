import { createServiceClient } from '@/lib/supabase/server';
import { ensureUserProfile, createOrganization } from '@/lib/auth/helpers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { email, password, fullName, companyName } = await request.json();

  if (!email || !password || !fullName || !companyName) {
    return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. Create user with admin API (auto-confirms email, no trigger dependency)
  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    // Handle duplicate email
    if (createError.message?.includes('already been registered')) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  const userId = userData.user.id;

  // 2. Create user profile
  const profileResult = await ensureUserProfile(userId, email, fullName);
  if (profileResult.error) {
    return NextResponse.json({ error: profileResult.error }, { status: 500 });
  }

  // 3. Create organization + membership
  const orgResult = await createOrganization(userId, companyName);
  if ('error' in orgResult) {
    return NextResponse.json({ error: orgResult.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, orgId: orgResult.orgId });
}
