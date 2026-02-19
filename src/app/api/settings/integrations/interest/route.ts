import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireActiveSubscription } from '@/lib/auth/helpers';
import type { IntegrationProvider } from '@/lib/types/database';

const VALID_PROVIDERS: IntegrationProvider[] = ['appfolio', 'yardi', 'buildium'];

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const { provider, email } = await request.json();

  if (!VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
  }

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error: insertError } = await supabase
    .from('cw_integration_interest')
    .upsert(
      {
        org_id: context.orgId,
        provider,
        email,
      },
      { onConflict: 'org_id,provider' }
    );

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
