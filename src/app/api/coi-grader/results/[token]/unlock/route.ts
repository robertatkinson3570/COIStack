import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { GraderCheckResult } from '@/lib/grader/types';
import type { CoiExtractedFields } from '@/lib/types/database';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Require authenticated session
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find the upload
  const { data: upload, error: uploadError } = await supabase
    .from('cw_grader_uploads')
    .select('id')
    .eq('public_token', token)
    .single();

  if (uploadError || !upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
  }

  // Unlock the result
  const { data: result, error: updateError } = await supabase
    .from('cw_grader_results')
    .update({
      email_unlocked: true,
      unlocked_by_user_id: user.id,
      unlocked_at: new Date().toISOString(),
    })
    .eq('upload_id', upload.id)
    .select('*')
    .single();

  if (updateError || !result) {
    console.error('Unlock failed:', updateError);
    return NextResponse.json({ error: 'Failed to unlock results' }, { status: 500 });
  }

  // Track event
  await supabase.from('cw_grader_events').insert({
    upload_id: upload.id,
    event_type: 'results_unlocked',
    metadata: { user_id: user.id },
  });

  const extracted = result.extracted_json as CoiExtractedFields;

  return NextResponse.json({
    overall_grade: result.overall_grade,
    pass_count: result.pass_count,
    fail_count: result.fail_count,
    unknown_count: result.unknown_count,
    named_insured: extracted?.named_insured ?? null,
    email_unlocked: true,
    checks: result.checks_json as GraderCheckResult[],
    extracted_fields: extracted,
    confidence: result.confidence,
  });
}
