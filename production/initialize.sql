-- Run ONLY on the verified empty production DB after explicit initialization approval.
-- Initialization is separate from approval to activate customer ordering.
-- Normal migrations seed the four approved products. Never import staging data.
-- No order, history, payment, audit or event seed belongs here.
INSERT INTO application_settings(key,value)
 SELECT 'dataset','production' WHERE NOT EXISTS(SELECT 1 FROM orders)
 AND NOT EXISTS(SELECT 1 FROM event_sales) AND NOT EXISTS(SELECT 1 FROM audit_log)
 AND NOT EXISTS(SELECT 1 FROM financial_events)
 ON CONFLICT(key) DO NOTHING;
UPDATE application_settings SET value='true' WHERE key='orders_paused'
 AND (SELECT value FROM application_settings WHERE key='dataset')='production'
 AND NOT EXISTS(SELECT 1 FROM orders);
