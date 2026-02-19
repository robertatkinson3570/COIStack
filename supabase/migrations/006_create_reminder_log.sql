CREATE TABLE cw_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES cw_vendors(id),
  stage cw_reminder_stage NOT NULL,
  message_preview TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cw_reminder_log_vendor_id ON cw_reminder_log(vendor_id);
CREATE INDEX idx_cw_reminder_log_sent_at ON cw_reminder_log(sent_at);
