import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole, requireActiveSubscription } from '@/lib/auth/helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const roleError = requireRole(context, ['owner', 'admin', 'member']);
  if (roleError) return roleError;

  // Plan gate — Pro and Scale only
  if (context.org.plan_tier !== 'pro' && context.org.plan_tier !== 'scale') {
    return NextResponse.json(
      { error: 'Vendor self-service portal requires a Pro or Scale plan' },
      { status: 403 }
    );
  }

  const { id: vendorId } = await params;
  const supabase = createServiceClient();

  // Verify vendor belongs to this org
  const { data: vendor } = await supabase
    .from('cw_vendors')
    .select('id, name')
    .eq('id', vendorId)
    .eq('org_id', context.orgId)
    .single();

  if (!vendor) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  // Deactivate any existing active links for this vendor
  await supabase
    .from('cw_vendor_portal_links')
    .update({ active: false })
    .eq('vendor_id', vendorId)
    .eq('org_id', context.orgId)
    .eq('active', true);

  // Create new portal link
  const { data: link, error: insertError } = await supabase
    .from('cw_vendor_portal_links')
    .insert({
      org_id: context.orgId,
      vendor_id: vendorId,
      created_by: context.user.id,
    })
    .select('token, expires_at')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://coistack.com';
  const url = `${baseUrl}/vendor-portal/${link.token}`;

  return NextResponse.json({
    token: link.token,
    url,
    expires_at: link.expires_at,
  });
}
