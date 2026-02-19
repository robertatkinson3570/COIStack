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

export async function POST(request: NextRequest) {
  // Authenticate via webhook secret
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.EMAIL_INGEST_WEBHOOK_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { to, from, subject, attachments } = body as {
    to: string;
    from: string;
    subject?: string;
    attachments?: { filename: string; content: string; contentType: string }[];
  };

  if (!to || !from) {
    return NextResponse.json({ error: 'Missing to/from fields' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Look up the org by ingest email address
  const { data: ingestAddr } = await supabase
    .from('cw_email_ingest_addresses')
    .select('org_id, active')
    .eq('ingest_email', to.toLowerCase())
    .eq('active', true)
    .single();

  if (!ingestAddr) {
    return NextResponse.json({ error: 'Unknown ingest address' }, { status: 404 });
  }

  const orgId = ingestAddr.org_id;

  // Try to match vendor by sender email
  const { data: vendor } = await supabase
    .from('cw_vendors')
    .select('id, trade_type')
    .eq('org_id', orgId)
    .eq('email', from.toLowerCase())
    .single();

  // Filter PDF attachments
  const pdfAttachments = (attachments ?? []).filter(
    (a) => a.contentType === 'application/pdf' && a.content
  );

  if (pdfAttachments.length === 0) {
    // Log the failed ingest
    await supabase.from('cw_email_ingest_log').insert({
      org_id: orgId,
      from_email: from,
      subject: subject ?? null,
      vendor_id_matched: vendor?.id ?? null,
      status: 'failed',
      error_message: 'No PDF attachments found',
    });

    return NextResponse.json({ processed: 0, message: 'No PDF attachments' });
  }

  let processedCount = 0;

  for (const attachment of pdfAttachments) {
    const buffer = Buffer.from(attachment.content, 'base64');

    if (buffer.length > MAX_FILE_SIZE) {
      await supabase.from('cw_email_ingest_log').insert({
        org_id: orgId,
        from_email: from,
        subject: subject ?? null,
        vendor_id_matched: vendor?.id ?? null,
        status: 'failed',
        error_message: `Attachment ${attachment.filename} exceeds 4MB limit`,
      });
      continue;
    }

    const checksum = createHash('sha256').update(buffer).digest('hex');

    // If no vendor match, log and skip processing
    if (!vendor) {
      await supabase.from('cw_email_ingest_log').insert({
        org_id: orgId,
        from_email: from,
        subject: subject ?? null,
        vendor_id_matched: null,
        status: 'unmatched',
        error_message: `No vendor found with email ${from}`,
      });
      continue;
    }

    // Check for duplicates
    const { data: existing } = await supabase
      .from('cw_documents')
      .select('id')
      .eq('vendor_id', vendor.id)
      .eq('checksum', checksum)
      .eq('org_id', orgId)
      .limit(1)
      .single();

    if (existing) {
      await supabase.from('cw_email_ingest_log').insert({
        org_id: orgId,
        from_email: from,
        subject: subject ?? null,
        vendor_id_matched: vendor.id,
        status: 'processed',
        error_message: 'Duplicate document — already uploaded',
      });
      continue;
    }

    // Upload to storage
    const timestamp = Date.now();
    const storagePath = `${orgId}/cois/${vendor.id}/${timestamp}_${attachment.filename}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      await supabase.from('cw_email_ingest_log').insert({
        org_id: orgId,
        from_email: from,
        subject: subject ?? null,
        vendor_id_matched: vendor.id,
        status: 'failed',
        error_message: `Storage upload failed: ${uploadError.message}`,
      });
      continue;
    }

    // Insert document
    const { data: doc, error: insertError } = await supabase
      .from('cw_documents')
      .insert({
        org_id: orgId,
        vendor_id: vendor.id,
        file_url: storagePath,
        file_name: attachment.filename,
        file_size: buffer.length,
        checksum,
        source: 'email-ingest',
        uploaded_by: null,
      })
      .select('id')
      .single();

    if (insertError || !doc) {
      await supabase.from('cw_email_ingest_log').insert({
        org_id: orgId,
        from_email: from,
        subject: subject ?? null,
        vendor_id_matched: vendor.id,
        status: 'failed',
        error_message: insertError?.message ?? 'Failed to insert document',
      });
      continue;
    }

    // Run extraction + scoring pipeline
    try {
      const base64Images = await pdfToBase64Images(buffer);
      const extraction = await extractCoi(getLLMClient(), base64Images);

      await supabase.from('cw_coi_extractions').insert({
        org_id: orgId,
        document_id: doc.id,
        extracted_json: extraction,
        confidence: extraction.confidence_score,
        needs_review: !extraction.policy_expiration_date || extraction.confidence_score < 0.7,
      });

      // Score compliance
      const { data: template } = await supabase
        .from('cw_requirements_templates')
        .select('rules_json')
        .eq('org_id', orgId)
        .eq('trade_type', vendor.trade_type)
        .single();

      if (template) {
        const result = scoreCompliance(extraction, template.rules_json as ComplianceRules);
        await supabase
          .from('cw_compliance_status')
          .upsert({
            vendor_id: vendor.id,
            org_id: orgId,
            status: result.status,
            reasons_json: result.reasons,
            next_expiry_date: result.next_expiry_date,
            last_checked_at: new Date().toISOString(),
          }, { onConflict: 'vendor_id' });
      }
    } catch (err) {
      console.error('Email ingest extraction error:', err);
    }

    await supabase.from('cw_email_ingest_log').insert({
      org_id: orgId,
      from_email: from,
      subject: subject ?? null,
      vendor_id_matched: vendor.id,
      document_id: doc.id,
      status: 'processed',
    });

    processedCount++;
  }

  return NextResponse.json({ processed: processedCount });
}
