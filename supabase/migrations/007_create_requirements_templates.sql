CREATE TABLE cw_requirements_templates (
  trade_type cw_trade_type PRIMARY KEY,
  rules_json JSONB NOT NULL
);
