import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Validate token — must be active and not expired
  const { data: link, error } = await supabase
    .from('cw_vendor_portal_links')
    .select('id, vendor_id, org_id, expires_at, active')
    .eq('token', token)
    .eq('active', true)
    .single();

  if (error || !link) {
    return NextResponse.json({ error: 'Invalid or expired portal link' }, { status: 404 });
  }

  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This portal link has expired' }, { status: 410 });
  }

  // Fetch vendor name and org name for the upload page
  const [{ data: vendor }, { data: org }] = await Promise.all([
    supabase
      .from('cw_vendors')
      .select('name, trade_type')
      .eq('id', link.vendor_id)
      .single(),
    supabase
      .from('cw_organizations')
      .select('name, logo_url')
      .eq('id', link.org_id)
      .single(),
  ]);

  return NextResponse.json({
    vendor_name: vendor?.name ?? 'Unknown Vendor',
    vendor_trade: vendor?.trade_type ?? 'OTHER',
    org_name: org?.name ?? 'Unknown Organization',
    org_logo: org?.logo_url ?? null,
  });
}
