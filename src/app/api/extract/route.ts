import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole, requireActiveSubscription } from '@/lib/auth/helpers';
import { getLLMClient } from '@/lib/claude/client';
import { extractCoi } from '@/lib/claude/extract-coi';
import { pdfToBase64Images } from '@/lib/pdf/to-images';
import { scoreCompliance } from '@/lib/compliance/scorer';
import { diffExtractions } from '@/lib/compliance/diff';
import { CoiExtractedFields, TradeType } from '@/lib/types/database';
import { STORAGE_BUCKET } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const roleError = requireRole(context, ['owner', 'admin', 'member']);
  if (roleError) return roleError;

  const supabase = createServiceClient();
  const { document_id } = await request.json();

  if (!document_id) {
    return NextResponse.json({ error: 'document_id is required' }, { status: 400 });
  }

  // 1. Get document + vendor info — scoped to org
  const { data: doc, error: docError } = await supabase
    .from('cw_documents')
    .select('*, cw_vendors(id, name, trade_type)')
    .eq('id', document_id)
    .eq('org_id', context.orgId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const vendor = doc.cw_vendors as unknown as { id: string; name: string; trade_type: TradeType };

  // 2. Download PDF from storage
  const { data: pdfBlob, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(doc.file_url);

  if (downloadError || !pdfBlob) {
    return NextResponse.json(
      { error: `Failed to download PDF: ${downloadError?.message}` },
      { status: 500 }
    );
  }

  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());

  // 3. Convert PDF to images
  let base64Images: string[];
  try {
    base64Images = await pdfToBase64Images(pdfBuffer);
  } catch (err) {
    return NextResponse.json(
      { error: `PDF conversion failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 }
    );
  }

  const pagesToSend = base64Images.slice(0, 2);

  // 4. Extract via LLM Vision
  const llm = getLLMClient();
  let extracted: CoiExtractedFields;
  try {
    extracted = await extractCoi(llm, pagesToSend);
  } catch (err) {
    return NextResponse.json(
      { error: `Extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 }
    );
  }

  // 5. Determine needs_review
  const needsReview =
    !extracted.policy_expiration_date ||
    extracted.confidence_score < 0.7;

  // 6. Store extraction — with org_id
  const { data: extraction, error: extractionError } = await supabase
    .from('cw_coi_extractions')
    .insert({
      org_id: context.orgId,
      document_id,
      extracted_json: extracted,
      confidence: extracted.confidence_score,
      needs_review: needsReview,
    })
    .select('id')
    .single();

  if (extractionError) {
    return NextResponse.json({ error: extractionError.message }, { status: 500 });
  }

  // 7. Get compliance template — scoped to org
  const { data: template } = await supabase
    .from('cw_requirements_templates')
    .select('rules_json')
    .eq('trade_type', vendor.trade_type)
    .eq('org_id', context.orgId)
    .single();

  const rules = template?.rules_json;
  if (!rules) {
    return NextResponse.json({ error: 'No compliance template found' }, { status: 500 });
  }

  // 8. Score compliance
  const score = scoreCompliance(extracted, rules);

  // 9. Diff with previous extraction
  const { data: previousDocs } = await supabase
    .from('cw_documents')
    .select('id')
    .eq('vendor_id', vendor.id)
    .eq('org_id', context.orgId)
    .neq('id', document_id)
    .order('created_at', { ascending: false })
    .limit(1);

  let diff = null;
  if (previousDocs && previousDocs.length > 0) {
    const { data: prevExtraction } = await supabase
      .from('cw_coi_extractions')
      .select('extracted_json')
      .eq('document_id', previousDocs[0].id)
      .order('extracted_at', { ascending: false })
      .limit(1)
      .single();

    if (prevExtraction) {
      diff = diffExtractions(extracted, prevExtraction.extracted_json as CoiExtractedFields);

      if (diff.has_regression) {
        await supabase
          .from('cw_coi_extractions')
          .update({
            needs_review: true,
            extracted_json: {
              ...extracted,
              raw_text_notes: [
                extracted.raw_text_notes,
                `REGRESSION: ${diff.regressions.join('; ')}`,
              ].filter(Boolean).join(' | '),
            },
          })
          .eq('id', extraction.id);
      }
    }
  }

  // 10. Upsert compliance status — with org_id
  await supabase
    .from('cw_compliance_status')
    .upsert({
      vendor_id: vendor.id,
      org_id: context.orgId,
      status: score.status,
      reasons_json: score.reasons,
      next_expiry_date: score.next_expiry_date,
      last_checked_at: new Date().toISOString(),
    });

  return NextResponse.json({
    extraction_id: extraction.id,
    extracted_json: extracted,
    confidence: extracted.confidence_score,
    needs_review: needsReview || (diff?.has_regression ?? false),
    compliance: {
      status: score.status,
      reasons: score.reasons,
    },
    diff,
  });
}
