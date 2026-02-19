import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/helpers';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: ticket, error: ticketError } = await supabase
    .from('cw_support_tickets')
    .select('*')
    .eq('id', id)
    .eq('org_id', context.orgId)
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const { data: messages, error: msgError } = await supabase
    .from('cw_ticket_messages')
    .select('*, cw_user_profiles(full_name)')
    .eq('ticket_id', id)
    .order('created_at');

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  return NextResponse.json({ ticket, messages: messages || [] });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const { status } = await request.json();
  const supabase = createServiceClient();

  const updates: Record<string, unknown> = { status };
  if (status === 'resolved') {
    updates.resolved_at = new Date().toISOString();
  }

  const { data, error: updateError } = await supabase
    .from('cw_support_tickets')
    .update(updates)
    .eq('id', id)
    .eq('org_id', context.orgId)
    .eq('user_id', context.user.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
