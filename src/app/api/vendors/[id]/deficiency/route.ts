import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole, requireActiveSubscription } from '@/lib/auth/helpers';
import { sendEmail, buildDeficiencyNoticeEmail } from '@/lib/email/send';
import { writeAuditLog } from '@/lib/audit/log';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const roleError = requireRole(context, ['owner', 'admin', 'member']);
  if (roleError) return roleError;

  const { id: vendorId } = await params;
  const supabase = createServiceClient();

  // Fetch vendor + compliance status
  const [vendorRes, complianceRes] = await Promise.all([
    supabase
      .from('cw_vendors')
      .select('id, name, email, trade_type')
      .eq('id', vendorId)
      .eq('org_id', context.orgId)
      .single(),
    supabase
      .from('cw_compliance_status')
      .select('status, reasons_json')
      .eq('vendor_id', vendorId)
      .eq('org_id', context.orgId)
      .single(),
  ]);

  if (vendorRes.error || !vendorRes.data) {
    return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
  }

  const vendor = vendorRes.data;
  const reasons = (complianceRes.data?.reasons_json as string[]) || ['No COI on file'];

  if (!vendor.email) {
    return NextResponse.json({ error: 'Vendor has no email address on file' }, { status: 400 });
  }

  // Send deficiency notice
  const { subject, html } = buildDeficiencyNoticeEmail({
    vendorName: vendor.name,
    tradeType: vendor.trade_type,
    reasons,
    orgName: context.org.name,
  });

  const result = await sendEmail({ to: vendor.email, subject, html });

  // Audit log
  writeAuditLog({
    org_id: context.orgId,
    user_id: context.user.id,
    action: 'deficiency.sent',
    target_type: 'vendor',
    target_id: vendorId,
    metadata: { reasons, email_sent: result.success },
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    vendor_name: vendor.name,
    reasons,
  });
}
