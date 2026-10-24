ALTER TABLE orders ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'new' CHECK(workflow_status IN ('new','confirmed','in_production','ready','completed','cancelled'));
ALTER TABLE orders ADD COLUMN internal_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN confirmed_arrangements TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN confirmation_evidence TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN last_mutation_id TEXT;
ALTER TABLE products ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN last_mutation_id TEXT;
ALTER TABLE application_settings ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE application_settings ADD COLUMN last_mutation_id TEXT;
ALTER TABLE payment_status ADD COLUMN amount_refunded_cents INTEGER NOT NULL DEFAULT 0 CHECK(amount_refunded_cents >= 0 AND amount_refunded_cents <= amount_paid_cents);
CREATE TABLE event_sales (
 id TEXT PRIMARY KEY, request_hash TEXT NOT NULL, event_name TEXT NOT NULL, event_date TEXT NOT NULL,
 notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','voided')),
 total_cents INTEGER NOT NULL CHECK(typeof(total_cents)='integer' AND total_cents>=0),
 cost_cents INTEGER, version INTEGER NOT NULL DEFAULT 0, last_mutation_id TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE event_sale_items (
 id INTEGER PRIMARY KEY, sale_id TEXT NOT NULL REFERENCES event_sales(id), product_id TEXT NOT NULL REFERENCES products(id),
 product_name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 9999 AND typeof(quantity)='integer'),
 unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0 AND typeof(unit_price_cents)='integer'),
 unit_cost_cents INTEGER, UNIQUE(sale_id,product_id)
);
CREATE TABLE audit_log (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
 before_json TEXT NOT NULL, after_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE financial_events (
 id TEXT PRIMARY KEY, mutation_id TEXT NOT NULL REFERENCES audit_log(id),
 entity_type TEXT NOT NULL CHECK(entity_type IN ('order','event')), entity_id TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('payment','refund','event_sale','event_void')),
 amount_cents INTEGER NOT NULL CHECK(typeof(amount_cents)='integer'), cost_cents INTEGER,
 accounting_date TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX audit_entity ON audit_log(entity_type,entity_id,created_at);
CREATE INDEX financial_date ON financial_events(accounting_date);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'Audit is append-only'); END;
CREATE TRIGGER finance_no_update BEFORE UPDATE ON financial_events BEGIN SELECT RAISE(ABORT,'Financial history is append-only'); END;
CREATE TRIGGER finance_no_delete BEFORE DELETE ON financial_events BEGIN SELECT RAISE(ABORT,'Financial history is append-only'); END;
