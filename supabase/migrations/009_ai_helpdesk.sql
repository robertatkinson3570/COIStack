-- ============================================================
-- COIStack AI Helpdesk — Database Migration
-- ============================================================

-- 1. Chat sessions table
CREATE TABLE cw_ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Chat messages table
CREATE TABLE cw_ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cw_ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Daily usage tracking for rate limits
CREATE TABLE cw_ai_chat_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES cw_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, usage_date)
);

-- Indexes
CREATE INDEX idx_ai_sessions_org ON cw_ai_chat_sessions(org_id);
CREATE INDEX idx_ai_sessions_user ON cw_ai_chat_sessions(user_id);
CREATE INDEX idx_ai_messages_session ON cw_ai_chat_messages(session_id);
CREATE INDEX idx_ai_usage_user_date ON cw_ai_chat_usage(user_id, usage_date);

-- RLS
ALTER TABLE cw_ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_ai_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cw_ai_chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own chat sessions"
  ON cw_ai_chat_sessions FOR SELECT
  USING (user_id = auth.uid() AND org_id = cw_get_user_org_id());

CREATE POLICY "Users can create chat sessions"
  ON cw_ai_chat_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid() AND org_id = cw_get_user_org_id());

CREATE POLICY "Users can delete own chat sessions"
  ON cw_ai_chat_sessions FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can view messages in own sessions"
  ON cw_ai_chat_messages FOR SELECT
  USING (session_id IN (
    SELECT id FROM cw_ai_chat_sessions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert messages in own sessions"
  ON cw_ai_chat_messages FOR INSERT
  WITH CHECK (session_id IN (
    SELECT id FROM cw_ai_chat_sessions WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view own usage"
  ON cw_ai_chat_usage FOR SELECT
  USING (user_id = auth.uid());

-- Usage increment function (called from API via service role)
CREATE OR REPLACE FUNCTION cw_increment_ai_usage(p_user_id UUID, p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO cw_ai_chat_usage (user_id, org_id, usage_date, message_count)
  VALUES (p_user_id, p_org_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET message_count = cw_ai_chat_usage.message_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
