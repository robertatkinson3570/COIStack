import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/helpers';
import { getAiMessageLimit } from '@/lib/types/database';

export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  const supabase = createServiceClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('cw_ai_chat_usage')
    .select('message_count')
    .eq('user_id', context.user.id)
    .eq('usage_date', today)
    .single();

  const limit = getAiMessageLimit(context.org.plan_tier);

  return NextResponse.json({
    used: data?.message_count ?? 0,
    limit: limit === Infinity ? -1 : limit, // -1 signals unlimited
    plan: context.org.plan_tier,
  });
}
