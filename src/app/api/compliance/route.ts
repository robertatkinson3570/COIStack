import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireActiveSubscription } from '@/lib/auth/helpers';

export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const supabase = createServiceClient();

  // Fetch all vendors, compliance statuses, and latest documents in 3 batch queries
  // instead of N+1 queries per vendor
  const [vendorRes, complianceRes, latestDocsRes] = await Promise.all([
    supabase
      .from('cw_vendors')
      .select('id, name, email, trade_type')
      .eq('org_id', context.orgId)
      .order('name'),
    supabase
      .from('cw_compliance_status')
      .select('vendor_id, status, reasons_json, next_expiry_date, last_checked_at')
      .eq('org_id', context.orgId),
    supabase
      .from('cw_documents')
      .select('vendor_id, created_at')
      .eq('org_id', context.orgId)
      .order('created_at', { ascending: false }),
  ]);

  if (vendorRes.error) {
    return NextResponse.json({ error: vendorRes.error.message }, { status: 500 });
  }

  // Build lookup maps for O(1) access
  const complianceMap = new Map(
    (complianceRes.data ?? []).map((c) => [c.vendor_id, c])
  );

  // For latest doc per vendor, take the first occurrence (already sorted desc by created_at)
  const latestDocMap = new Map<string, string>();
  for (const doc of latestDocsRes.data ?? []) {
    if (!latestDocMap.has(doc.vendor_id)) {
      latestDocMap.set(doc.vendor_id, doc.created_at);
    }
  }

  const results = (vendorRes.data ?? []).map((vendor) => {
    const compliance = complianceMap.get(vendor.id);
    return {
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      vendor_email: vendor.email,
      trade_type: vendor.trade_type,
      status: compliance?.status ?? 'red',
      reasons: compliance?.reasons_json ?? ['No COI on file'],
      next_expiry_date: compliance?.next_expiry_date ?? null,
      last_checked_at: compliance?.last_checked_at ?? null,
      last_upload_date: latestDocMap.get(vendor.id) ?? null,
    };
  });

  return NextResponse.json(results);
}
