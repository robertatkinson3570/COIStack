import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole, requireActiveSubscription } from '@/lib/auth/helpers';

export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const supabase = createServiceClient();

  const { data, error: dbError } = await supabase
    .from('cw_vendors')
    .select('*')
    .eq('org_id', context.orgId)
    .order('name');

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const roleError = requireRole(context, ['owner', 'admin', 'member']);
  if (roleError) return roleError;

  const supabase = createServiceClient();
  const { name, email, trade_type, contact_name, phone, notes } = await request.json();

  if (!name || !trade_type) {
    return NextResponse.json(
      { error: 'name and trade_type are required' },
      { status: 400 }
    );
  }

  // Enforce vendor limit
  if (context.org.vendor_count >= context.org.vendor_limit) {
    return NextResponse.json(
      {
        error: `You've reached your plan's vendor limit (${context.org.vendor_limit}). Upgrade to add more vendors.`,
      },
      { status: 403 }
    );
  }

  const { data, error: insertError } = await supabase
    .from('cw_vendors')
    .insert({
      org_id: context.orgId,
      name,
      email: email || null,
      trade_type,
      contact_name: contact_name || null,
      phone: phone || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
