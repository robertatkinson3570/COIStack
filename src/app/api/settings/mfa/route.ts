import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole } from '@/lib/auth/helpers';
import { writeAuditLog } from '@/lib/audit/log';

// GET: return current MFA enforcement status
export async function GET() {
  const { context, error } = await requireAuth();
  if (error) return error;

  return NextResponse.json({
    mfa_enforced: context.org.mfa_enforced ?? false,
  });
}

// PUT: toggle MFA enforcement (owner/admin only)
export async function PUT(request: NextRequest) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const roleError = requireRole(context, ['owner', 'admin']);
  if (roleError) return roleError;

  const body = await request.json();
  const mfaEnforced = Boolean(body.mfa_enforced);

  const supabase = createServiceClient();

  const { error: updateError } = await supabase
    .from('cw_organizations')
    .update({ mfa_enforced: mfaEnforced })
    .eq('id', context.orgId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  writeAuditLog({
    org_id: context.orgId,
    user_id: context.user.id,
    action: 'mfa.toggle',
    metadata: { mfa_enforced: mfaEnforced },
  });

  return NextResponse.json({ mfa_enforced: mfaEnforced });
}
