import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { GRADER_TEMPLATES } from '@/lib/grader/templates';
import type { GraderTemplateKey, GraderResultsResponse, GraderCheckResult } from '@/lib/grader/types';
import type { CoiExtractedFields } from '@/lib/types/database';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const supabase = createServiceClient();

  // Fetch upload + result in a single query via join
  const { data: upload, error: uploadError } = await supabase
    .from('cw_grader_uploads')
    .select('id, status, template_key, error_message')
    .eq('public_token', token)
    .single();

  if (uploadError || !upload) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 });
  }

  if (upload.status === 'processing') {
    return NextResponse.json({ status: 'processing' }, { status: 202 });
  }

  if (upload.status === 'failed') {
    return NextResponse.json(
      { status: 'failed', error: upload.error_message || 'Processing failed' },
      { status: 422 }
    );
  }

  const { data: result, error: resultError } = await supabase
    .from('cw_grader_results')
    .select('*')
    .eq('upload_id', upload.id)
    .single();

  if (resultError || !result) {
    return NextResponse.json({ error: 'Results not found' }, { status: 404 });
  }

  const templateKey = upload.template_key as GraderTemplateKey;
  const templateName = GRADER_TEMPLATES[templateKey]?.name || 'Standard Commercial';
  const extracted = result.extracted_json as CoiExtractedFields;

  const response: GraderResultsResponse = {
    overall_grade: result.overall_grade,
    pass_count: result.pass_count,
    fail_count: result.fail_count,
    unknown_count: result.unknown_count,
    named_insured: extracted?.named_insured ?? null,
    template_name: templateName,
    email_unlocked: result.email_unlocked,
  };

  // Only include gated fields if unlocked
  if (result.email_unlocked) {
    response.checks = result.checks_json as GraderCheckResult[];
    response.extracted_fields = extracted;
    response.confidence = result.confidence;
  }

  return NextResponse.json(response);
}
