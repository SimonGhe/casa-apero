-- Additive only. Existing orders, prices, payments and audit records stay intact.
-- source remains local_test so the admin's fictional-dataset guard still applies.
CREATE TABLE test_checkout_orders (
 order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 tester_hash TEXT NOT NULL CHECK(length(tester_hash)=64),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX test_checkout_owner ON test_checkout_orders(tester_hash,order_id);
