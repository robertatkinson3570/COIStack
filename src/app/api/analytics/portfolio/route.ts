import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireActiveSubscription } from '@/lib/auth/helpers';

export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  // Plan gate — Pro and Scale only
  if (context.org.plan_tier !== 'pro' && context.org.plan_tier !== 'scale') {
    return NextResponse.json(
      { error: 'Portfolio analytics requires a Pro or Scale plan' },
      { status: 403 }
    );
  }

  const supabase = createServiceClient();

  // Get all compliance statuses for this org
  const { data: statuses } = await supabase
    .from('cw_compliance_status')
    .select('vendor_id, status, next_expiry_date, reasons_json')
    .eq('org_id', context.orgId);

  // Get vendor info for trade type breakdown
  const { data: vendors } = await supabase
    .from('cw_vendors')
    .select('id, name, trade_type')
    .eq('org_id', context.orgId);

  // Get recent compliance snapshots for trend data (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: snapshots } = await supabase
    .from('cw_compliance_snapshots')
    .select('status, snapshot_date')
    .eq('org_id', context.orgId)
    .gte('snapshot_date', sixMonthsAgo.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });

  const allStatuses = statuses ?? [];
  const allVendors = vendors ?? [];
  const allSnapshots = snapshots ?? [];

  // Status distribution
  const greenCount = allStatuses.filter((s) => s.status === 'green').length;
  const yellowCount = allStatuses.filter((s) => s.status === 'yellow').length;
  const redCount = allStatuses.filter((s) => s.status === 'red').length;
  const totalVendors = allVendors.length;
  const complianceRate = totalVendors > 0 ? Math.round((greenCount / totalVendors) * 100) : 0;

  // Status by trade type
  const vendorMap = new Map(allVendors.map((v) => [v.id, v]));
  const tradeBreakdown: Record<string, { green: number; yellow: number; red: number }> = {};

  for (const s of allStatuses) {
    const vendor = vendorMap.get(s.vendor_id);
    const trade = vendor?.trade_type ?? 'OTHER';
    if (!tradeBreakdown[trade]) tradeBreakdown[trade] = { green: 0, yellow: 0, red: 0 };
    tradeBreakdown[trade][s.status as 'green' | 'yellow' | 'red']++;
  }

  // Monthly compliance trend from snapshots
  const monthlyTrend: Record<string, { green: number; yellow: number; red: number; total: number }> = {};
  for (const snap of allSnapshots) {
    const month = snap.snapshot_date.substring(0, 7); // YYYY-MM
    if (!monthlyTrend[month]) monthlyTrend[month] = { green: 0, yellow: 0, red: 0, total: 0 };
    monthlyTrend[month][snap.status as 'green' | 'yellow' | 'red']++;
    monthlyTrend[month].total++;
  }

  const trend = Object.entries(monthlyTrend).map(([month, counts]) => ({
    month,
    complianceRate: counts.total > 0 ? Math.round((counts.green / counts.total) * 100) : 0,
    ...counts,
  }));

  // Upcoming expirations (next 90 days)
  const now = new Date();
  const ninetyDays = new Date();
  ninetyDays.setDate(ninetyDays.getDate() + 90);

  const expirations: { month: string; count: number }[] = [];
  const expirationMap: Record<string, number> = {};

  for (const s of allStatuses) {
    if (s.next_expiry_date) {
      const expiry = new Date(s.next_expiry_date);
      if (expiry >= now && expiry <= ninetyDays) {
        const month = s.next_expiry_date.substring(0, 7);
        expirationMap[month] = (expirationMap[month] || 0) + 1;
      }
    }
  }

  for (const [month, count] of Object.entries(expirationMap).sort()) {
    expirations.push({ month, count });
  }

  // Top non-compliant vendors
  const nonCompliant = allStatuses
    .filter((s) => s.status === 'red')
    .map((s) => {
      const vendor = vendorMap.get(s.vendor_id);
      return {
        vendor_id: s.vendor_id,
        vendor_name: vendor?.name ?? 'Unknown',
        trade_type: vendor?.trade_type ?? 'OTHER',
        reasons: s.reasons_json ?? [],
        next_expiry_date: s.next_expiry_date,
      };
    })
    .slice(0, 10);

  return NextResponse.json({
    summary: {
      totalVendors,
      complianceRate,
      green: greenCount,
      yellow: yellowCount,
      red: redCount,
    },
    statusDistribution: [
      { name: 'Compliant', value: greenCount, color: '#22c55e' },
      { name: 'Expiring Soon', value: yellowCount, color: '#eab308' },
      { name: 'Non-Compliant', value: redCount, color: '#ef4444' },
    ],
    tradeBreakdown: Object.entries(tradeBreakdown).map(([trade, counts]) => ({
      trade,
      ...counts,
    })),
    trend,
    expirations,
    nonCompliant,
  });
}
