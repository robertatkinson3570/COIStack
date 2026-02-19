import { createServiceClient } from '@/lib/supabase/server';

export type AuditAction =
  | 'vendor.create'
  | 'vendor.update'
  | 'vendor.delete'
  | 'document.upload'
  | 'document.delete'
  | 'compliance.check'
  | 'reminder.sent'
  | 'deficiency.sent'
  | 'member.invite'
  | 'member.remove'
  | 'member.role_change'
  | 'settings.update'
  | 'billing.portal_open'
  | 'export.download'
  | 'mfa.toggle';

export interface AuditEntry {
  org_id: string;
  user_id: string;
  action: AuditAction;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit log entry. Fire-and-forget — errors are logged but never thrown.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('cw_audit_log').insert({
      org_id: entry.org_id,
      user_id: entry.user_id,
      action: entry.action,
      target_type: entry.target_type ?? null,
      target_id: entry.target_id ?? null,
      metadata: entry.metadata ?? null,
    });
    if (error) {
      console.error('[audit] Failed to write log:', error.message);
    }
  } catch (err) {
    console.error('[audit] Unexpected error:', err);
  }
}
