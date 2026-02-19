CREATE TABLE cw_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  trade_type cw_trade_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
