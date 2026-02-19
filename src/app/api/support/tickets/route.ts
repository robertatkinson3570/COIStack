import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/helpers';

export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  const supabase = createServiceClient();

  const { data, error: dbError } = await supabase
    .from('cw_support_tickets')
    .select('*')
    .eq('org_id', context.orgId)
    .order('created_at', { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const supabase = createServiceClient();
  const { subject, description, priority } = await request.json();

  if (!subject || !description) {
    return NextResponse.json(
      { error: 'subject and description are required' },
      { status: 400 }
    );
  }

  const { data, error: insertError } = await supabase
    .from('cw_support_tickets')
    .insert({
      org_id: context.orgId,
      user_id: context.user.id,
      subject,
      description,
      priority: priority || 'medium',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
