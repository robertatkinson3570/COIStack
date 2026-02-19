import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = emailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid email' },
      { status: 400 }
    );
  }

  const { email } = parsed.data;
  const supabase = createServiceClient();

  // Verify the upload exists
  const { data: upload, error: uploadError } = await supabase
    .from('cw_grader_uploads')
    .select('id')
    .eq('public_token', token)
    .single();

  if (uploadError || !upload) {
    return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
  }

  // Record the lead
  const { error: leadError } = await supabase.from('cw_lead_captures').insert({
    email,
    upload_id: upload.id,
    source: 'grader',
  });

  if (leadError) {
    console.error('Lead capture failed:', leadError);
    // Don't block the user — the lead insert is non-critical
  }

  // Track event
  await supabase.from('cw_grader_events').insert({
    upload_id: upload.id,
    event_type: 'email_submitted',
    metadata: { email_domain: email.split('@')[1] },
  });

  return NextResponse.json({ success: true });
}
