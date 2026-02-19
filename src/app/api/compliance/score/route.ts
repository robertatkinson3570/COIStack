import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireActiveSubscription } from '@/lib/auth/helpers';
import { scoreCompliance } from '@/lib/compliance/scorer';
import { CoiExtractedFields } from '@/lib/types/database';

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const supabase = createServiceClient();
  const { extraction_id } = await request.json();

  if (!extraction_id) {
    return NextResponse.json({ error: 'extraction_id is required' }, { status: 400 });
  }

  const { data: extraction, error: extError } = await supabase
    .from('cw_coi_extractions')
    .select('*, cw_documents(vendor_id, cw_vendors(id, trade_type))')
    .eq('id', extraction_id)
    .eq('org_id', context.orgId)
    .single();

  if (extError || !extraction) {
    return NextResponse.json({ error: 'Extraction not found' }, { status: 404 });
  }

  const vendorInfo = extraction.cw_documents as unknown as {
    vendor_id: string;
    cw_vendors: { id: string; trade_type: string };
  };

  const { data: template } = await supabase
    .from('cw_requirements_templates')
    .select('rules_json')
    .eq('trade_type', vendorInfo.cw_vendors.trade_type)
    .eq('org_id', context.orgId)
    .single();

  if (!template) {
    return NextResponse.json({ error: 'No compliance template found' }, { status: 500 });
  }

  const score = scoreCompliance(
    extraction.extracted_json as CoiExtractedFields,
    template.rules_json
  );

  await supabase
    .from('cw_compliance_status')
    .upsert({
      vendor_id: vendorInfo.vendor_id,
      org_id: context.orgId,
      status: score.status,
      reasons_json: score.reasons,
      next_expiry_date: score.next_expiry_date,
      last_checked_at: new Date().toISOString(),
    });

  return NextResponse.json(score);
}
