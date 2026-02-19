import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/helpers';

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const { sessionId, subject, priority } = await request.json();

  if (!sessionId || !subject) {
    return NextResponse.json({ error: 'sessionId and subject are required' }, { status: 400 });
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const ticketPriority = validPriorities.includes(priority) ? priority : 'medium';

  const supabase = createServiceClient();

  // Verify session ownership
  const { data: session, error: sessionError } = await supabase
    .from('cw_ai_chat_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', context.user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Fetch all messages
  const { data: messages } = await supabase
    .from('cw_ai_chat_messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  // Format conversation into readable description
  const conversationText = (messages || [])
    .map((m) => {
      const timestamp = new Date(m.created_at).toLocaleString();
      const prefix = m.role === 'user' ? 'User' : 'AI';
      return `[${timestamp}] ${prefix}:\n${m.content}`;
    })
    .join('\n\n---\n\n');

  const description = `--- Escalated from AI Chat ---\n\n${conversationText}`;

  // Create support ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('cw_support_tickets')
    .insert({
      org_id: context.orgId,
      user_id: context.user.id,
      subject,
      description,
      priority: ticketPriority,
    })
    .select('id')
    .single();

  if (ticketError || !ticket) {
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }

  return NextResponse.json({ data: { ticketId: ticket.id } });
}
