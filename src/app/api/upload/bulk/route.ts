import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole, requireActiveSubscription } from '@/lib/auth/helpers';
import { pdfToBase64Images } from '@/lib/pdf/to-images';
import { extractCoi } from '@/lib/claude/extract-coi';
import { scoreCompliance } from '@/lib/compliance/scorer';
import { STORAGE_BUCKET, MAX_FILE_SIZE } from '@/lib/constants';
import { getLLMClient } from '@/lib/claude/client';
import type { ComplianceRules } from '@/lib/types/database';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_FILES = 50;

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const roleError = requireRole(context, ['owner', 'admin', 'member']);
  if (roleError) return roleError;

  // Plan gate — Pro and Scale only
  if (context.org.plan_tier !== 'pro' && context.org.plan_tier !== 'scale') {
    return NextResponse.json(
      { error: 'Bulk upload requires a Pro or Scale plan' },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const vendorMappingRaw = formData.get('vendor_mapping') as string | null;
  const files = formData.getAll('files') as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files per bulk upload` },
      { status: 400 }
    );
  }

  // Parse optional vendor mapping: { "filename.pdf": "vendor-uuid" }
  let vendorMapping: Record<string, string> = {};
  if (vendorMappingRaw) {
    try {
      vendorMapping = JSON.parse(vendorMappingRaw);
    } catch {
      return NextResponse.json({ error: 'Invalid vendor_mapping JSON' }, { status: 400 });
    }
  }

  const supabase = createServiceClient();
  const openai = getLLMClient();

  const results: {
    filename: string;
    status: 'success' | 'duplicate' | 'error';
    document_id?: string;
    error?: string;
  }[] = [];

  // Process files sequentially to avoid overwhelming APIs
  for (const file of files) {
    if (file.type !== 'application/pdf') {
      results.push({ filename: file.name, status: 'error', error: 'Not a PDF file' });
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      results.push({ filename: file.name, status: 'error', error: 'Exceeds 4MB limit' });
      continue;
    }

    const vendorId = vendorMapping[file.name];
    if (!vendorId) {
      results.push({ filename: file.name, status: 'error', error: 'No vendor mapping provided' });
      continue;
    }

    // Verify vendor belongs to org
    const { data: vendor } = await supabase
      .from('cw_vendors')
      .select('id, trade_type')
      .eq('id', vendorId)
      .eq('org_id', context.orgId)
      .single();

    if (!vendor) {
      results.push({ filename: file.name, status: 'error', error: 'Vendor not found' });
      continue;
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const checksum = createHash('sha256').update(buffer).digest('hex');

    // Check for duplicate
    const { data: existing } = await supabase
      .from('cw_documents')
      .select('id')
      .eq('vendor_id', vendorId)
      .eq('checksum', checksum)
      .eq('org_id', context.orgId)
      .limit(1)
      .single();

    if (existing) {
      results.push({ filename: file.name, status: 'duplicate', document_id: existing.id });
      continue;
    }

    // Upload to storage
    const timestamp = Date.now();
    const storagePath = `${context.orgId}/cois/${vendorId}/${timestamp}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      results.push({ filename: file.name, status: 'error', error: uploadError.message });
      continue;
    }

    // Insert document
    const { data: doc, error: insertError } = await supabase
      .from('cw_documents')
      .insert({
        org_id: context.orgId,
        vendor_id: vendorId,
        file_url: storagePath,
        file_name: file.name,
        file_size: buffer.length,
        checksum,
        source: 'bulk-upload',
        uploaded_by: context.user.id,
      })
      .select('id')
      .single();

    if (insertError || !doc) {
      results.push({ filename: file.name, status: 'error', error: insertError?.message ?? 'Insert failed' });
      continue;
    }

    // Run extraction + scoring
    try {
      const base64Images = await pdfToBase64Images(buffer);
      const extraction = await extractCoi(openai, base64Images);

      await supabase.from('cw_coi_extractions').insert({
        org_id: context.orgId,
        document_id: doc.id,
        extracted_json: extraction,
        confidence: extraction.confidence_score,
        needs_review: !extraction.policy_expiration_date || extraction.confidence_score < 0.7,
      });

      const { data: template } = await supabase
        .from('cw_requirements_templates')
        .select('rules_json')
        .eq('org_id', context.orgId)
        .eq('trade_type', vendor.trade_type)
        .single();

      if (template) {
        const result = scoreCompliance(extraction, template.rules_json as ComplianceRules);
        await supabase
          .from('cw_compliance_status')
          .upsert({
            vendor_id: vendorId,
            org_id: context.orgId,
            status: result.status,
            reasons_json: result.reasons,
            next_expiry_date: result.next_expiry_date,
            last_checked_at: new Date().toISOString(),
          }, { onConflict: 'vendor_id' });
      }
    } catch (err) {
      console.error(`Bulk upload extraction error for ${file.name}:`, err);
    }

    results.push({ filename: file.name, status: 'success', document_id: doc.id });
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const duplicateCount = results.filter((r) => r.status === 'duplicate').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  return NextResponse.json({
    total: files.length,
    success: successCount,
    duplicates: duplicateCount,
    errors: errorCount,
    results,
  });
}
