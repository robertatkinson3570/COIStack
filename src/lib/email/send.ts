import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'noreply@coistack.com';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set — skipping email send');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: options.to,
      subject: options.subject,
      html: options.html,
      replyTo: options.replyTo,
    });

    if (error) {
      console.error('[email] Send failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[email] Unexpected error:', err);
    return { success: false, error: 'Unexpected send error' };
  }
}

export function buildReminderEmail(params: {
  vendorName: string;
  tradeType: string;
  expiryDate: string;
  stage: string;
  reasons: string[];
  orgName: string;
  portalUrl?: string;
}): { subject: string; html: string } {
  const isExpired = params.stage === 'expired_weekly';
  const subject = isExpired
    ? `Action Required: COI for ${params.vendorName} has expired`
    : `COI Reminder: ${params.vendorName} certificate expiring soon`;

  const reasonsList = params.reasons.length > 0
    ? `<ul>${params.reasons.map((r) => `<li>${r}</li>`).join('')}</ul>`
    : '';

  const portalSection = params.portalUrl
    ? `<p><a href="${params.portalUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;">Upload Updated COI</a></p>`
    : '';

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#111;">Certificate of Insurance ${isExpired ? 'Expired' : 'Expiring Soon'}</h2>
      <p>Dear ${params.vendorName},</p>
      <p>This is a reminder from <strong>${params.orgName}</strong> regarding your Certificate of Insurance (COI) for <strong>${params.tradeType}</strong> services.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Vendor</td><td style="padding:8px;border:1px solid #e5e7eb;">${params.vendorName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Trade</td><td style="padding:8px;border:1px solid #e5e7eb;">${params.tradeType}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Expiry Date</td><td style="padding:8px;border:1px solid #e5e7eb;">${params.expiryDate}</td></tr>
      </table>
      ${reasonsList ? `<p><strong>Compliance Issues:</strong></p>${reasonsList}` : ''}
      <p>Please provide an updated certificate at your earliest convenience.</p>
      ${portalSection}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="font-size:12px;color:#6b7280;">Sent by COIStack on behalf of ${params.orgName}.</p>
    </div>
  `;

  return { subject, html };
}

export function buildDeficiencyNoticeEmail(params: {
  vendorName: string;
  tradeType: string;
  reasons: string[];
  orgName: string;
  portalUrl?: string;
}): { subject: string; html: string } {
  const subject = `Compliance Deficiency Notice: ${params.vendorName}`;

  const reasonsList = params.reasons.map((r) => `<li style="margin-bottom:4px;">${r}</li>`).join('');

  const portalSection = params.portalUrl
    ? `<p><a href="${params.portalUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;border-radius:6px;text-decoration:none;">Upload Corrected COI</a></p>`
    : '';

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;">
      <h2 style="color:#dc2626;">Compliance Deficiency Notice</h2>
      <p>Dear ${params.vendorName},</p>
      <p><strong>${params.orgName}</strong> has identified the following compliance deficiencies in your Certificate of Insurance for <strong>${params.tradeType}</strong> services:</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:16px 0;">
        <ul style="margin:0;padding-left:20px;">${reasonsList}</ul>
      </div>
      <p>Please provide a corrected certificate addressing the above issues within <strong>10 business days</strong>.</p>
      ${portalSection}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="font-size:12px;color:#6b7280;">Sent by COIStack on behalf of ${params.orgName}.</p>
    </div>
  `;

  return { subject, html };
}

export function buildContactSalesNotification(params: {
  name: string;
  email: string;
  company: string;
  vendorCount: string;
  message: string;
}): { subject: string; html: string } {
  const subject = `Enterprise Inquiry: ${params.company}`;

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;">
      <h2>New Enterprise Sales Inquiry</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Name</td><td style="padding:8px;border:1px solid #e5e7eb;">${params.name}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Email</td><td style="padding:8px;border:1px solid #e5e7eb;">${params.email}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Company</td><td style="padding:8px;border:1px solid #e5e7eb;">${params.company}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">Vendor Count</td><td style="padding:8px;border:1px solid #e5e7eb;">${params.vendorCount}</td></tr>
      </table>
      ${params.message ? `<p><strong>Message:</strong></p><p>${params.message}</p>` : ''}
    </div>
  `;

  return { subject, html };
}
