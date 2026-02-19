import { NextResponse } from 'next/server';
import { parseISO } from 'date-fns';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, requireRole, requireActiveSubscription } from '@/lib/auth/helpers';
import { computeReminderStage, generateMessagePreview } from '@/lib/reminders/engine';
import { sendEmail, buildReminderEmail } from '@/lib/email/send';
import { writeAuditLog } from '@/lib/audit/log';

export async function POST() {
  const { context, error } = await requireAuth();
  if (error) return error;

  const subError = requireActiveSubscription(context);
  if (subError) return subError;

  const roleError = requireRole(context, ['owner', 'admin', 'member']);
  if (roleError) return roleError;

  const supabase = createServiceClient();
  const today = new Date();

  // Get all compliance statuses for this org
  const { data: statuses, error: dbError } = await supabase
    .from('cw_compliance_status')
    .select('*, cw_vendors(id, name, email, trade_type)')
    .eq('org_id', context.orgId);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  const reminders: Array<{
    vendor_name: string;
    stage: string;
    message: string;
    email_sent: boolean;
  }> = [];

  for (const status of statuses || []) {
    if (!status.next_expiry_date) continue;

    const vendor = status.cw_vendors as unknown as {
      id: string;
      name: string;
      email: string | null;
      trade_type: string;
    };

    const expiryDate = parseISO(status.next_expiry_date);
    const stage = computeReminderStage(expiryDate, today);

    if (!stage) continue;

    // Deduplication
    if (stage === 'expired_weekly') {
      const { data: recent } = await supabase
        .from('cw_reminder_log')
        .select('id')
        .eq('vendor_id', vendor.id)
        .eq('stage', 'expired_weekly')
        .eq('org_id', context.orgId)
        .gte('sent_at', new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (recent && recent.length > 0) continue;
    } else {
      const { data: existing } = await supabase
        .from('cw_reminder_log')
        .select('id')
        .eq('vendor_id', vendor.id)
        .eq('stage', stage)
        .eq('org_id', context.orgId)
        .limit(1);

      if (existing && existing.length > 0) continue;
    }

    const message = generateMessagePreview(
      vendor.name,
      vendor.trade_type,
      status.next_expiry_date,
      stage,
      (status.reasons_json as string[]) || []
    );

    // Send email via Resend if vendor has an email address
    let emailSent = false;
    if (vendor.email) {
      const { subject, html } = buildReminderEmail({
        vendorName: vendor.name,
        tradeType: vendor.trade_type,
        expiryDate: status.next_expiry_date,
        stage,
        reasons: (status.reasons_json as string[]) || [],
        orgName: context.org.name,
      });

      const result = await sendEmail({ to: vendor.email, subject, html });
      emailSent = result.success;
    }

    await supabase.from('cw_reminder_log').insert({
      org_id: context.orgId,
      vendor_id: vendor.id,
      stage,
      message_preview: message,
    });

    reminders.push({
      vendor_name: vendor.name,
      stage,
      message,
      email_sent: emailSent,
    });
  }

  // Audit log
  writeAuditLog({
    org_id: context.orgId,
    user_id: context.user.id,
    action: 'reminder.sent',
    metadata: { count: reminders.length, emails_sent: reminders.filter((r) => r.email_sent).length },
  });

  return NextResponse.json({
    reminders_sent: reminders.length,
    emails_sent: reminders.filter((r) => r.email_sent).length,
    details: reminders,
  });
}
