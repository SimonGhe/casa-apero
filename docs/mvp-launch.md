# MVP webshop — implementation and final switch

Current state: [real pickup request activation](order-request-activation.md)
supersedes the closed-ordering configuration recorded below. The owner explicitly
authorized request intake with incomplete documents still labelled as drafts.

25 October 2026 update: production D1 is initialized with the four approved
products and zero transactions. Both domains now use their production Workers;
ordering and admin writes remain disabled. See [the production cutover record](production-cutover.md)
for active versions, verified Access login, safeguards and exact rollback.
The [production setup record](production-setup.md) preserves initialization and backup details.
Public checkout and production admin are prepared locally on develop.
The earlier Phase 6 Access-gated fictional checkout remains available in code;
it is not a dependency of the public production checkout.

## Working flow

Catalogue and cart -> pickup-only non-binding request -> persistent receipt ->
existing Access-protected student admin -> personal confirmation -> production
-> ready for collection -> completed. Payments are recorded separately after
receipt, cash or an agreed electronic method, and appear in reports. No payment
gateway, customer account, automatic email or fulfilment service was added.

The public checkout uses current D1 products/prices, not a static price import.
Server validation, Turnstile, same-origin checks, transient IP/global rate limits,
atomic order/audit creation, historical price snapshots and idempotent retries
remain in force. Delivery is rejected server-side, not merely hidden in the UI.
The receipt requires an opaque capability and reveals no customer contact data.

The complete flow is tested with fictional records in local D1, using the existing
compiled-worker/browser harness. No additional staging environment was created.

## What is still needed from the owner/school

These remain **to be confirmed**, without preventing local implementation:

- Legal seller/status; establishment, pickup and return addresses; applicable
  enterprise/VAT details or confirmed exemption; approved public email/phone.
- School/Vlajo approval and final customer terms, privacy and withdrawal process.
- Approved school mailbox and responsible person; where customer acceptance,
  sent confirmations and versioned terms will be retained; privacy controller,
  contact and retention rules.
- Working production Turnstile widget/secret configuration and explicit approval
  of the final domain/database switch. Never send the secret through chat.

The legal pages intentionally retain their unapproved placeholders. Populate and
approve those facts before activating real requests; no legal identity, private
student contact or approval was fabricated. Also check the applicable online
withdrawal/acknowledgement requirement when approving that process; a mailto link
is not silently assumed to satisfy it. [FOD guidance](https://economie.fgov.be/nl/themas/verkoop/reglementering/herroepingstermijnen/herroepingsrecht-bij-aankoop).

## Simple manual confirmation procedure

1. Review the request, capacity, prices and pickup arrangements in admin.
2. From the approved school mailbox send the complete offer: reference, products,
   quantities, unit prices/total, zero pickup costs, pickup location/contact
   procedure, approximately two weeks' production, payment on collection and the
   full approved terms/withdrawal information as email text or fixed attachment.
3. Obtain the customer's explicit acceptance. Send the final complete confirmation
   and archive the offer, acceptance, sent confirmation and exact terms version
   in the approved school record system.
4. Use the existing admin confirmation fields to record the arrangements,
   zero extra costs, evidence/file reference and date/time provided. Then mark
   Bevestigd. Start production afterward; record money only when received.

The receipt page says that personal confirmation is still required and that no
automatic email was sent. It can be printed/saved as PDF; it does not pretend to
be the durable contract confirmation. [FOD confirmation guidance](https://economie.fgov.be/nl/themas/ondernemingen/guidance/handelspraktijken/informatieverplichting-bij-e/veelgestelde-vragen-over-de).

## Production preparation (run remotely only after final approval)

- Storefront config: `wrangler.shop.jsonc`, Worker `casa-apero`, mode `shop`.
- Admin config: `wrangler.admin.production.jsonc`, Worker `casa-apero-admin`,
  mode `admin-production`. Keep the existing admin Access policy, issuer, AUD
  and administrator allowlist. Admin workers.dev/preview URLs stay disabled.
- Both bind only the existing EU `casa-apero-prod`, UUID
  `5d4d738b-4d84-4826-a15d-4652e7e191bd`. Local development uses local D1;
  `remote:false` is explicit. Staging keeps its own database and Workers.
- Confirm the remote production DB is still empty before its first migration.
  Apply migrations 0001–0005 through the ledger, then `production/initialize.sql`.
  Normal migrations seed Olive 699, Dune Mini 699, Dune Grand 1299, Aperitivo
  2599 cents. Initialization imports no staging data and creates zero orders,
  payments, sales or financial/audit transactions. It starts globally paused.
- Production guard refuses the staging marker and test orders. Never copy or
  restore staging transactions into production. The empty test-ownership schema
  is harmless shared schema, not imported fictional data.
- Ignored `.env.shop.local`: `CASA_PUBLIC_ORDERS_ENABLED=false`,
  `CASA_LAUNCH_APPROVED=false`, `CASA_APPROVED_LEGAL_VERSION` and
  `CASA_SHOP_TURNSTILE_SITE_KEY`. A real Turnstile secret belongs only in the
  Worker's secret binding. Both flags and an approved non-draft legal version
  are required server-side before requests are accepted.
- Ignored `.env.admin-production.local`: `CASA_ADMIN_ACCESS_ISSUER`,
  `CASA_ADMIN_ACCESS_AUDIENCE`, `CASA_ADMIN_EMAIL_ALLOWLIST`, and
  `CASA_PRODUCTION_ADMIN_WRITES_ENABLED` (false until approved).
- Build with `pnpm build:shop` and `pnpm build:admin-production`. Inspect exact
  bindings, disabled flags, no secrets in assets, no local-login code, and capture
  current Worker versions/domain mappings before the approved switch.
- Only after approved legal text/configuration, production initialization and
  final owner approval: deploy the two generated production configurations,
  transfer the existing public/admin custom-domain mappings from staging to
  production Workers, enable the production flags and explicitly resume ordering
  in admin. Checkout uses `/bestellen` and `/api/*`; it needs no Access app.
  The old `/test-bestellen` Access application is not used. Do not remove/change
  existing Access policies as an unapproved side effect.
- Verify an approved real-world acceptance check after switching. For rollback,
  pause production and restore the recorded staging domain mappings/versions.
  Preserve production orders and export its current state first; never restore
  a fictional staging backup over production. Data rollback requires separate
  approval. No switch or recovery command was executed during this work.

## Validation

All 184 local cases passed: 104 unit/integration/security, 48 storefront browser,
8 local admin browser, 4 public staging browser, 10 compiled Access admin browser,
and 10 checkout browser cases (including the new full public workflow on desktop
and mobile). Existing checks were retained. All seven builds/TypeScript passed;
dependency audit found no known vulnerabilities. Production artifact inspection
confirmed exact production-only bindings, disabled activation/write flags, no
frontend secrets/private config, and no deployed local-login code. No remote
production/staging data was queried or modified.

The focused check starts with four products and zero orders, submits without a
customer account/Access token, reloads the receipt, confirms the request in the
existing admin, records a fictional cash payment, advances through production,
collection and completion, reloads admin, and verifies paid revenue in reports.
It uses only fictional local data and mock Siteverify transport. It does not
claim that real online Turnstile or the final production switch was tested.

Run the focused workflow with the existing harness:

```powershell
pnpm.cmd build:shop
pnpm.cmd build:admin-production
pnpm.cmd exec playwright test --config playwright.test-checkout.config.ts --grep "public pickup"
```

The existing complete checkout browser command now also needs these two builds
alongside `build:test-checkout` and `build:admin-preview`. No new test framework,
customer account system, staging environment or paid service was introduced.
