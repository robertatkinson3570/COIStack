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

  // Verify session belongs to user
  const { data: session, error: sessionError } = await supabase
    .from('cw_ai_chat_sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', context.user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const { data: messages, error: msgError } = await supabase
    .from('cw_ai_chat_messages')
    .select('*')
    .eq('session_id', id)
    .order('created_at', { ascending: true });

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  return NextResponse.json({ data: { session, messages: messages || [] } });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = createServiceClient();

  // Verify ownership then delete (cascade deletes messages)
  const { error: deleteError } = await supabase
    .from('cw_ai_chat_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', context.user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
