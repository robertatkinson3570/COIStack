import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const { message } = await request.json();

  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Verify ticket belongs to this org
  const { data: ticket } = await supabase
    .from('cw_support_tickets')
    .select('id')
    .eq('id', id)
    .eq('org_id', context.orgId)
    .single();

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const { data, error: insertError } = await supabase
    .from('cw_ticket_messages')
    .insert({
      ticket_id: id,
      user_id: context.user.id,
      message,
      is_staff: false,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Update ticket updated_at
  await supabase
    .from('cw_support_tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json(data, { status: 201 });
}
