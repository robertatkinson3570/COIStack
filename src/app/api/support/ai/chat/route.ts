import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getAnthropicClient } from '@/lib/anthropic/client';
import { AI_HELPDESK_SYSTEM_PROMPT } from '@/lib/anthropic/helpdesk-prompt';
import { getAiMessageLimit } from '@/lib/types/database';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  // Plan gating — Starter and trial users cannot use AI chat
  const planTier = context.org.plan_tier;
  const limit = getAiMessageLimit(planTier);
  if (limit === 0) {
    return NextResponse.json(
      { error: 'AI helpdesk is available on Growth plans and above' },
      { status: 403 }
    );
  }

  const supabase = createServiceClient();

  // Rate limit check
  const today = new Date().toISOString().split('T')[0];
  const { data: usage } = await supabase
    .from('cw_ai_chat_usage')
    .select('message_count')
    .eq('user_id', context.user.id)
    .eq('usage_date', today)
    .single();

  const currentCount = usage?.message_count ?? 0;
  if (currentCount >= limit) {
    return NextResponse.json(
      {
        error: `Daily message limit reached (${limit} messages on ${planTier} plan). Resets at midnight UTC.`,
        code: 'RATE_LIMITED',
      },
      { status: 429 }
    );
  }

  // Parse request
  const { sessionId, message } = await request.json();
  if (!sessionId || !message || typeof message !== 'string') {
    return NextResponse.json({ error: 'sessionId and message are required' }, { status: 400 });
  }

  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message must be 2000 characters or less' }, { status: 400 });
  }

  // Verify session ownership
  const { data: session, error: sessionError } = await supabase
    .from('cw_ai_chat_sessions')
    .select('id, title')
    .eq('id', sessionId)
    .eq('user_id', context.user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Save user message
  await supabase.from('cw_ai_chat_messages').insert({
    session_id: sessionId,
    role: 'user',
    content: message,
  });

  // Fetch recent messages for context (up to 50)
  const { data: history } = await supabase
    .from('cw_ai_chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(50);

  const messages: MessageParam[] = (history || []).map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Stream response from Anthropic
  const anthropic = getAnthropicClient();
  const encoder = new TextEncoder();
  let fullResponse = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 1024,
          system: AI_HELPDESK_SYSTEM_PROMPT,
          messages,
        });

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();

        // Post-stream: save assistant message, increment usage, auto-title
        await supabase.from('cw_ai_chat_messages').insert({
          session_id: sessionId,
          role: 'assistant',
          content: fullResponse,
        });

        await supabase.rpc('cw_increment_ai_usage', {
          p_user_id: context.user.id,
          p_org_id: context.orgId,
        });

        // Auto-title from first user message
        if (session.title === 'New conversation') {
          const title = message.substring(0, 100);
          await supabase
            .from('cw_ai_chat_sessions')
            .update({ title, updated_at: new Date().toISOString() })
            .eq('id', sessionId);
        } else {
          await supabase
            .from('cw_ai_chat_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', sessionId);
        }
      } catch (err) {
        console.error('AI chat stream error:', err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
