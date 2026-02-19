import { differenceInDays, parseISO } from 'date-fns';
import { ReminderStage } from '@/lib/types/database';

export interface ReminderCandidate {
  vendor_id: string;
  vendor_name: string;
  vendor_email: string | null;
  trade_type: string;
  next_expiry_date: string;
  stage: ReminderStage;
  message_preview: string;
  missing_items: string[];
}

export function computeReminderStage(
  expiryDate: Date,
  today: Date = new Date()
): ReminderStage | null {
  const daysUntil = differenceInDays(expiryDate, today);

  if (daysUntil < 0) return 'expired_weekly';
  if (daysUntil <= 1) return '1d';
  if (daysUntil <= 7) return '7d';
  if (daysUntil <= 14) return '14d';
  if (daysUntil <= 30) return '30d';
  return null;
}

export function generateMessagePreview(
  vendorName: string,
  tradeType: string,
  expiryDateStr: string,
  stage: ReminderStage,
  reasons: string[]
): string {
  const expiry = parseISO(expiryDateStr);
  const today = new Date();
  const daysUntil = differenceInDays(expiry, today);

  let urgency: string;
  if (daysUntil < 0) {
    urgency = `expired ${Math.abs(daysUntil)} days ago`;
  } else if (daysUntil === 0) {
    urgency = 'expires today';
  } else if (daysUntil === 1) {
    urgency = 'expires tomorrow';
  } else {
    urgency = `expires in ${daysUntil} days (${expiryDateStr})`;
  }

  let message = `REMINDER: COI for ${vendorName} (${tradeType}) ${urgency}. Please request an updated certificate.`;

  if (reasons.length > 0) {
    message += ` Issues: ${reasons.join('; ')}.`;
  }

  return message;
}
