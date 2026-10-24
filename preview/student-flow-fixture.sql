-- FICTIONAL STAGING ONLY. Apply only with wrangler.admin.preview.jsonc.
-- Repeatable setup; never resets the original order or its audit history.
INSERT INTO orders(id,reference,receipt_token_hash,customer_name,email,arrangement,notes,subtotal_cents,legal_version,acknowledgement_at)
 VALUES('40000000-0000-4000-8000-000000000002','TEST-STUDENT-FLOW-001','unusable-student-preview-002','Fictieve Oefenklant','student-flow@example.invalid','pickup','OEFENBESTELLING — probeer de stappen met je team. Geen echte klant.',1398,'preview-draft','2026-10-24T10:00:00Z') ON CONFLICT(id) DO NOTHING;
INSERT INTO order_items(order_id,product_id,variant_id,product_name,quantity,unit_price_cents,line_total_cents,production_days)
 VALUES('40000000-0000-4000-8000-000000000002','olive','olive-standard','Olive',2,699,1398,14) ON CONFLICT(order_id,product_id) DO NOTHING;
INSERT INTO payment_status(order_id) VALUES('40000000-0000-4000-8000-000000000002') ON CONFLICT(order_id) DO NOTHING;
INSERT INTO audit_log(id,actor_id,action,entity_type,entity_id,before_json,after_json)
 VALUES('40000000-0000-4000-8000-000000000003','authorized-fictional-fixture-setup','fixture.seed','order','40000000-0000-4000-8000-000000000002','null','{"reference":"TEST-STUDENT-FLOW-001","fictional":true}') ON CONFLICT(id) DO NOTHING;
