import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getAiMessageLimit } from '@/lib/types/database';

export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  // Plan gating — only Growth+ can access AI chat sessions
  const limit = getAiMessageLimit(context.org.plan_tier);
  if (limit === 0) {
    return NextResponse.json(
      { error: 'AI helpdesk is available on Growth plans and above' },
      { status: 403 }
    );
  }

  const supabase = createServiceClient();

  const { data, error: dbError } = await supabase
    .from('cw_ai_chat_sessions')
    .select('*')
    .eq('user_id', context.user.id)
    .eq('org_id', context.orgId)
    .order('updated_at', { ascending: false });

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}

export async function POST() {
  const { context, error } = await requireAuth();
  if (error) return error;

  // Plan gating — only Growth+ can create AI chat sessions
  const limit = getAiMessageLimit(context.org.plan_tier);
  if (limit === 0) {
    return NextResponse.json(
      { error: 'AI helpdesk is available on Growth plans and above' },
      { status: 403 }
    );
  }

  const supabase = createServiceClient();

  const { data, error: insertError } = await supabase
    .from('cw_ai_chat_sessions')
    .insert({
      user_id: context.user.id,
      org_id: context.orgId,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
