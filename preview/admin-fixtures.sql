-- FICTIONAL ADMIN PREVIEW ONLY. Not a production migration or customer import.
CREATE TABLE IF NOT EXISTS admin_preview_guard(id INTEGER PRIMARY KEY CHECK(id=1),dataset TEXT NOT NULL);
INSERT INTO admin_preview_guard(id,dataset) VALUES(1,'casa-apero-admin-staging-fictional-v1') ON CONFLICT(id) DO NOTHING;
UPDATE application_settings SET value='true' WHERE key='orders_paused';
INSERT INTO orders(id,reference,receipt_token_hash,customer_name,email,arrangement,notes,subtotal_cents,legal_version,acknowledgement_at)
 VALUES('40000000-0000-4000-8000-000000000001','TEST-ADMIN-PREVIEW-001','unusable-preview-capability-001','Fictieve Previewklant','preview@example.invalid','pickup','FICTIEF — geen echte bestelling of productieopdracht.',1398,'preview-draft','2026-10-24T10:00:00Z') ON CONFLICT(id) DO NOTHING;
INSERT INTO order_items(order_id,product_id,variant_id,product_name,quantity,unit_price_cents,line_total_cents,production_days)
 VALUES('40000000-0000-4000-8000-000000000001','olive','olive-standard','Olive',2,699,1398,14) ON CONFLICT(order_id,product_id) DO NOTHING;
INSERT INTO payment_status(order_id) VALUES('40000000-0000-4000-8000-000000000001') ON CONFLICT(order_id) DO NOTHING;
