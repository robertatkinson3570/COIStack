import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { getLLMClient } from '@/lib/claude/client';
import { extractCoi } from '@/lib/claude/extract-coi';
import { pdfToBase64Images } from '@/lib/pdf/to-images';
import { gradeCompliance } from '@/lib/grader/compliance-engine';
import { getTemplate, isValidTemplateKey } from '@/lib/grader/templates';
import { hashIdentity, checkRateLimit } from '@/lib/grader/rate-limit';
import { GRADER_MAX_FILE_SIZE, GRADER_ACCEPTED_TYPES, STORAGE_BUCKET } from '@/lib/constants';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const templateKey = (formData.get('template_key') as string) || 'standard_commercial';

    // Validate file presence
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!GRADER_ACCEPTED_TYPES.includes(file.type as typeof GRADER_ACCEPTED_TYPES[number])) {
      return NextResponse.json(
        { error: 'Invalid file type. Accepted: PDF, PNG, JPEG' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > GRADER_MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Validate template
    if (!isValidTemplateKey(templateKey)) {
      return NextResponse.json({ error: 'Invalid template key' }, { status: 400 });
    }

    // Rate limit
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ua = request.headers.get('user-agent') || 'unknown';
    const ipHash = hashIdentity(ip, ua);

    const { allowed, remaining } = await checkRateLimit(ipHash);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again in 24 hours.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining) } }
      );
    }

    // Generate token and upload to storage
    const publicToken = crypto.randomUUID();
    const supabase = createServiceClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `grader/${publicToken}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, { contentType: file.type });

    if (uploadError) {
      console.error('Storage upload failed:', uploadError);
      return NextResponse.json({ error: 'File upload failed' }, { status: 500 });
    }

    // Insert upload record (status: processing)
    const { data: uploadRow, error: insertError } = await supabase
      .from('cw_grader_uploads')
      .insert({
        public_token: publicToken,
        file_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        ip_hash: ipHash,
        template_key: templateKey,
        status: 'processing',
      })
      .select('id')
      .single();

    if (insertError || !uploadRow) {
      console.error('Insert upload failed:', insertError);
      return NextResponse.json({ error: 'Failed to create upload record' }, { status: 500 });
    }

    // Convert to base64 images
    let base64Images: string[];
    try {
      if (file.type === 'application/pdf') {
        base64Images = await pdfToBase64Images(buffer);
      } else {
        // PNG or JPEG — single image
        base64Images = [buffer.toString('base64')];
      }
    } catch (err) {
      console.error('Image conversion failed:', err);
      await supabase
        .from('cw_grader_uploads')
        .update({ status: 'failed', error_message: 'Failed to process file' })
        .eq('id', uploadRow.id);
      return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
    }

    // Extract COI fields via LLM
    let extraction;
    try {
      extraction = await extractCoi(getLLMClient(), base64Images);
    } catch (err) {
      console.error('COI extraction failed:', err);
      await supabase
        .from('cw_grader_uploads')
        .update({ status: 'failed', error_message: 'COI extraction failed' })
        .eq('id', uploadRow.id);
      return NextResponse.json({ error: 'COI extraction failed' }, { status: 500 });
    }

    // Grade compliance
    const template = getTemplate(templateKey);
    const result = gradeCompliance(extraction, template);

    // Insert result
    const { error: resultError } = await supabase.from('cw_grader_results').insert({
      upload_id: uploadRow.id,
      extracted_json: extraction,
      confidence: extraction.confidence_score,
      overall_grade: result.overall_grade,
      checks_json: result.checks,
      pass_count: result.pass_count,
      fail_count: result.fail_count,
      unknown_count: result.unknown_count,
    });

    if (resultError) {
      console.error('Insert result failed:', resultError);
      await supabase
        .from('cw_grader_uploads')
        .update({ status: 'failed', error_message: 'Failed to save results' })
        .eq('id', uploadRow.id);
      return NextResponse.json({ error: 'Failed to save results' }, { status: 500 });
    }

    // Mark upload as completed
    await supabase
      .from('cw_grader_uploads')
      .update({ status: 'completed' })
      .eq('id', uploadRow.id);

    // Track event
    await supabase.from('cw_grader_events').insert({
      upload_id: uploadRow.id,
      event_type: 'upload_completed',
      metadata: { template_key: templateKey, grade: result.overall_grade },
      ip_hash: ipHash,
    });

    return NextResponse.json({
      token: publicToken,
      status: 'completed',
      overall_grade: result.overall_grade,
    });
  } catch (err) {
    console.error('Grader upload error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
