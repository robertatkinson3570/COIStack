import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole, requireActiveSubscription } from '@/lib/auth/helpers';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const roleError = requireRole(context, ['owner', 'admin', 'member']);
  if (roleError) return roleError;

  const { id } = await params;
  const body = await request.json();
  const supabase = createServiceClient();

  const { data, error: updateError } = await supabase
    .from('cw_vendors')
    .update({
      name: body.name,
      email: body.email,
      trade_type: body.trade_type,
      contact_name: body.contact_name,
      phone: body.phone,
      notes: body.notes,
    })
    .eq('id', id)
    .eq('org_id', context.orgId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const roleError = requireRole(context, ['owner', 'admin']);
  if (roleError) return roleError;

  const { id } = await params;
  const supabase = createServiceClient();

  const { error: deleteError } = await supabase
    .from('cw_vendors')
    .delete()
    .eq('id', id)
    .eq('org_id', context.orgId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
