import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireActiveSubscription } from '@/lib/auth/helpers';
import OpenAI from 'openai';

export async function GET(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const vendorId = request.nextUrl.searchParams.get('vendor_id');

  const supabase = createServiceClient();

  // Build the compliance data to summarize
  let complianceData: Array<{
    vendor_name: string;
    trade_type: string;
    status: string;
    reasons: string[];
    next_expiry_date: string | null;
  }>;

  if (vendorId) {
    // Single vendor summary
    const [vendorRes, statusRes] = await Promise.all([
      supabase.from('cw_vendors').select('name, trade_type').eq('id', vendorId).eq('org_id', context.orgId).single(),
      supabase.from('cw_compliance_status').select('status, reasons_json, next_expiry_date').eq('vendor_id', vendorId).eq('org_id', context.orgId).single(),
    ]);

    if (!vendorRes.data) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    complianceData = [{
      vendor_name: vendorRes.data.name,
      trade_type: vendorRes.data.trade_type,
      status: statusRes.data?.status ?? 'red',
      reasons: (statusRes.data?.reasons_json as string[]) ?? ['No COI on file'],
      next_expiry_date: statusRes.data?.next_expiry_date ?? null,
    }];
  } else {
    // Portfolio summary
    const [vendorRes, statusRes] = await Promise.all([
      supabase.from('cw_vendors').select('id, name, trade_type').eq('org_id', context.orgId),
      supabase.from('cw_compliance_status').select('vendor_id, status, reasons_json, next_expiry_date').eq('org_id', context.orgId),
    ]);

    const statusMap = new Map(
      (statusRes.data ?? []).map((s) => [s.vendor_id, s])
    );

    complianceData = (vendorRes.data ?? []).map((v) => {
      const status = statusMap.get(v.id);
      return {
        vendor_name: v.name,
        trade_type: v.trade_type,
        status: status?.status ?? 'red',
        reasons: (status?.reasons_json as string[]) ?? ['No COI on file'],
        next_expiry_date: status?.next_expiry_date ?? null,
      };
    });
  }

  if (complianceData.length === 0) {
    return NextResponse.json({ summary: 'No vendors found. Add vendors and upload COIs to see compliance summaries.' });
  }

  // Generate AI summary using Claude/OpenAI
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: generate a simple summary without AI
    const green = complianceData.filter((v) => v.status === 'green').length;
    const yellow = complianceData.filter((v) => v.status === 'yellow').length;
    const red = complianceData.filter((v) => v.status === 'red').length;

    const summary = vendorId
      ? `${complianceData[0].vendor_name} (${complianceData[0].trade_type}): Status is ${complianceData[0].status}. ${complianceData[0].reasons.length > 0 ? 'Issues: ' + complianceData[0].reasons.join(', ') + '.' : 'All requirements met.'}`
      : `Portfolio: ${green} compliant, ${yellow} expiring soon, ${red} non-compliant out of ${complianceData.length} vendors.${red > 0 ? ' Immediate action needed for non-compliant vendors.' : ''}`;

    return NextResponse.json({ summary });
  }

  // Use OpenAI-compatible client (works with Claude proxy or OpenAI)
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = vendorId
    ? `Summarize this vendor's COI compliance status in 2-3 sentences for a property manager. Be specific and actionable.\n\nVendor: ${JSON.stringify(complianceData[0])}`
    : `Summarize this portfolio's COI compliance status in 3-4 sentences for a property manager. Highlight the most urgent risks and recommended actions.\n\nPortfolio (${complianceData.length} vendors):\n${JSON.stringify(complianceData.slice(0, 50))}`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,
      messages: [
        { role: 'system', content: 'You are a compliance analyst for commercial real estate insurance. Provide clear, actionable summaries.' },
        { role: 'user', content: prompt },
      ],
    });

    const summary = response.choices[0]?.message?.content || 'Unable to generate summary.';
    return NextResponse.json({ summary });
  } catch (err) {
    console.error('[compliance-summary] AI error:', err);
    // Fallback
    const green = complianceData.filter((v) => v.status === 'green').length;
    const red = complianceData.filter((v) => v.status === 'red').length;
    return NextResponse.json({
      summary: `${green} of ${complianceData.length} vendors are compliant. ${red} need immediate attention.`,
    });
  }
}
