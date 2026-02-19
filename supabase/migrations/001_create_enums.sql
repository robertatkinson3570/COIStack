CREATE TYPE cw_trade_type AS ENUM ('GC', 'HVAC', 'CLEANING');
CREATE TYPE cw_compliance_status_enum AS ENUM ('green', 'yellow', 'red');
CREATE TYPE cw_reminder_stage AS ENUM ('30d', '14d', '7d', '1d', 'expired_weekly');
