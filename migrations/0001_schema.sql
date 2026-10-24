CREATE TABLE products (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK(typeof(price_cents) = 'integer' AND price_cents >= 0),
  production_days INTEGER NOT NULL DEFAULT 14 CHECK(production_days > 0),
  published INTEGER NOT NULL DEFAULT 1 CHECK(published IN (0,1)),
  orders_paused INTEGER NOT NULL DEFAULT 0 CHECK(orders_paused IN (0,1)),
  cost_cents INTEGER CHECK(cost_cents IS NULL OR (typeof(cost_cents) = 'integer' AND cost_cents >= 0))
);
CREATE TABLE application_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  receipt_token_hash TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  arrangement TEXT NOT NULL CHECK(arrangement IN ('pickup','delivery')),
  requested_date TEXT,
  notes TEXT,
  request_status TEXT NOT NULL DEFAULT 'received' CHECK(request_status IN ('received','offered','accepted','cancelled','closed')),
  contract_status TEXT NOT NULL DEFAULT 'none' CHECK(contract_status IN ('none','confirmed','withdrawn')),
  production_status TEXT NOT NULL DEFAULT 'not_started' CHECK(production_status IN ('not_started','in_production','ready','completed')),
  source TEXT NOT NULL DEFAULT 'local_test' CHECK(source IN ('local_test','web','physical')),
  subtotal_cents INTEGER NOT NULL CHECK(typeof(subtotal_cents) = 'integer' AND subtotal_cents >= 0),
  delivery_cents INTEGER CHECK(delivery_cents IS NULL OR (typeof(delivery_cents) = 'integer' AND delivery_cents >= 0)),
  total_cents INTEGER CHECK(total_cents IS NULL OR (typeof(total_cents) = 'integer' AND total_cents >= 0)),
  legal_version TEXT NOT NULL,
  acknowledgement_at TEXT NOT NULL,
  confirmed_at TEXT,
  durable_confirmation_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK(contract_status != 'confirmed' OR (total_cents IS NOT NULL AND confirmed_at IS NOT NULL AND durable_confirmation_at IS NOT NULL))
);
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  variant_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(typeof(quantity) = 'integer' AND quantity BETWEEN 1 AND 99),
  unit_price_cents INTEGER NOT NULL CHECK(typeof(unit_price_cents) = 'integer' AND unit_price_cents >= 0),
  line_total_cents INTEGER NOT NULL CHECK(line_total_cents = quantity * unit_price_cents),
  production_days INTEGER NOT NULL,
  unit_cost_cents INTEGER,
  UNIQUE(order_id, product_id)
);
CREATE TABLE order_status_history (
  id INTEGER PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('request','contract','production','payment')),
  from_status TEXT, to_status TEXT NOT NULL, actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE payment_status (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','paid','partially_refunded','refunded')),
  amount_paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(typeof(amount_paid_cents) = 'integer' AND amount_paid_cents >= 0),
  method TEXT, paid_at TEXT
);
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY, request_hash TEXT NOT NULL,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE rate_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX orders_created ON orders(created_at);
CREATE INDEX orders_workflow ON orders(request_status, production_status);
CREATE INDEX status_history_order ON order_status_history(order_id, created_at);
