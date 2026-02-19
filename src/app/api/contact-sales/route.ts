import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendEmail, buildContactSalesNotification } from '@/lib/email/send';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, company, vendorCount, message } = body;

  if (!name || !email || !company) {
    return NextResponse.json({ error: 'Name, email, and company are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Store the inquiry
  const { error: dbError } = await supabase.from('cw_contact_sales').insert({
    name,
    email,
    company,
    vendor_count: vendorCount || null,
    message: message || null,
    source: 'pricing_page',
  });

  if (dbError) {
    console.error('[contact-sales] DB error:', dbError.message);
    return NextResponse.json({ error: 'Failed to submit inquiry' }, { status: 500 });
  }

  // Send notification email to sales team
  const salesEmail = process.env.SALES_EMAIL || process.env.RESEND_FROM_EMAIL;
  if (salesEmail) {
    const { subject, html } = buildContactSalesNotification({
      name,
      email,
      company,
      vendorCount: vendorCount || 'Not specified',
      message: message || '',
    });

    await sendEmail({ to: salesEmail, subject, html, replyTo: email });
  }

  return NextResponse.json({ success: true });
}
