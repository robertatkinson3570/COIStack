import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireActiveSubscription } from '@/lib/auth/helpers';

export async function GET(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const supabase = createServiceClient();

  // Fetch vendors with their compliance status and expiry dates
  const [vendorRes, statusRes] = await Promise.all([
    supabase
      .from('cw_vendors')
      .select('id, name, trade_type')
      .eq('org_id', context.orgId),
    supabase
      .from('cw_compliance_status')
      .select('vendor_id, status, next_expiry_date, reasons_json')
      .eq('org_id', context.orgId),
  ]);

  if (vendorRes.error) {
    return NextResponse.json({ error: vendorRes.error.message }, { status: 500 });
  }

  const statusMap = new Map(
    (statusRes.data ?? []).map((s) => [s.vendor_id, s])
  );

  // Build calendar events from expiry dates
  const events = (vendorRes.data ?? [])
    .map((vendor) => {
      const compliance = statusMap.get(vendor.id);
      if (!compliance?.next_expiry_date) return null;

      return {
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        trade_type: vendor.trade_type,
        expiry_date: compliance.next_expiry_date,
        status: compliance.status,
        reasons: compliance.reasons_json ?? [],
      };
    })
    .filter(Boolean);

  // Sort by expiry date
  events.sort((a, b) => {
    if (!a || !b) return 0;
    return a.expiry_date.localeCompare(b.expiry_date);
  });

  return NextResponse.json({ events });
}
