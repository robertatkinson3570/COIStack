import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { pdfToBase64Images } from '@/lib/pdf/to-images';
import { extractCoi } from '@/lib/claude/extract-coi';
import { scoreCompliance } from '@/lib/compliance/scorer';
import { STORAGE_BUCKET, MAX_FILE_SIZE } from '@/lib/constants';
import { getLLMClient } from '@/lib/claude/client';
import type { ComplianceRules } from '@/lib/types/database';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Validate token
  const { data: link, error: linkError } = await supabase
    .from('cw_vendor_portal_links')
    .select('id, vendor_id, org_id, expires_at, active')
    .eq('token', token)
    .eq('active', true)
    .single();

  if (linkError || !link) {
    return NextResponse.json({ error: 'Invalid or expired portal link' }, { status: 404 });
  }

  if (new Date(link.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This portal link has expired' }, { status: 410 });
  }

  // Parse file from form data
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 4MB limit' }, { status: 413 });
  }

  // Read buffer and compute checksum
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const checksum = createHash('sha256').update(buffer).digest('hex');

  // Check for duplicate
  const { data: existing } = await supabase
    .from('cw_documents')
    .select('id')
    .eq('vendor_id', link.vendor_id)
    .eq('checksum', checksum)
    .eq('org_id', link.org_id)
    .limit(1)
    .single();

  if (existing) {
    return NextResponse.json({
      document_id: existing.id,
      is_duplicate: true,
      message: 'This document has already been uploaded.',
    });
  }

  // Upload to storage
  const timestamp = Date.now();
  const storagePath = `${link.org_id}/cois/${link.vendor_id}/${timestamp}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Insert document row
  const { data: doc, error: insertError } = await supabase
    .from('cw_documents')
    .insert({
      org_id: link.org_id,
      vendor_id: link.vendor_id,
      file_url: storagePath,
      file_name: file.name,
      file_size: buffer.length,
      checksum,
      source: 'vendor-portal',
      uploaded_by: null,
    })
    .select('id')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Run extraction + scoring pipeline
  try {
    const base64Images = await pdfToBase64Images(buffer);
    const extraction = await extractCoi(getLLMClient(), base64Images);

    // Save extraction — also flag if expiration date is missing (consistent with main extract route)
    const needsReview =
      !extraction.policy_expiration_date ||
      extraction.confidence_score < 0.7;
    await supabase.from('cw_coi_extractions').insert({
      org_id: link.org_id,
      document_id: doc.id,
      extracted_json: extraction,
      confidence: extraction.confidence_score,
      needs_review: needsReview,
    });

    // Score compliance
    const { data: template } = await supabase
      .from('cw_requirements_templates')
      .select('rules_json')
      .eq('org_id', link.org_id)
      .eq('trade_type', (
        await supabase
          .from('cw_vendors')
          .select('trade_type')
          .eq('id', link.vendor_id)
          .single()
      ).data?.trade_type ?? 'OTHER')
      .single();

    if (template) {
      const result = scoreCompliance(extraction, template.rules_json as ComplianceRules);

      await supabase
        .from('cw_compliance_status')
        .upsert({
          vendor_id: link.vendor_id,
          org_id: link.org_id,
          status: result.status,
          reasons_json: result.reasons,
          next_expiry_date: result.next_expiry_date,
          last_checked_at: new Date().toISOString(),
        }, { onConflict: 'vendor_id' });
    }
  } catch (pipelineError) {
    console.error('Vendor portal extraction pipeline error:', pipelineError);
    // Document is saved even if extraction fails — can be re-processed later
  }

  return NextResponse.json({
    document_id: doc.id,
    is_duplicate: false,
    message: 'Your certificate has been uploaded and is being processed.',
  });
}
