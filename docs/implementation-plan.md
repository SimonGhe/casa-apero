# Casa Apero implementation plan

## Inspection and requirement conflicts

Baseline: `1f66065`, original static HTML/CSS, one supplied atmosphere image,
clean `develop` branch. `main` points at the same baseline and is left unchanged.
There was no existing React application, database, API, admin or deployment setup
to preserve. The existing wordmark, colours and atmosphere asset are reused.

The original content included wooden boards, glasses and accessories; the confirmed
business sells handmade ceramic bowls. The first Phase 1 pass replaced those categories
with labelled examples. The subsequent official-content update replaces those examples
with the four confirmed products below. The old, unconfirmed mailto address was removed.

Earlier fixed-inventory requirements are superseded: no stock deduction, stock
counter or automatic sold-out flags. Use made-to-order production times and
independent product/global ordering pauses. Only product photography remains temporary;
the four names, descriptions and prices are now supplied by the students.

Earlier Cloudflare Pages / Raspberry Pi options are superseded by Workers with
Static Assets. GitHub Pages stays on `main`; no public domain switch yet.
No confirmation emails or online payments are required.

## Phase 1: local design review

Implemented in the existing checkout on `develop`:

- React/Vite/TypeScript/Tailwind setup with a lockfile.
- Dutch homepage, catalogue, product detail/gallery/variant selection.
- Working cart with quantity changes, removals and browser-local restoration.
- Clean URLs including `/bestellen`, mobile navigation and keyboard focus.
- Ordering pauses and clearly labelled temporary photography.
- Ordering information and inactive checkout handoff, contact/privacy placeholders.
- Unit and desktop/mobile browser tests.

Review the design locally before Phase 2. No checkout submission, customer data,
database, Worker or admin endpoint is included in this phase. No push or deployment.

## Official business content update

- Catalogue: Olive (699 cents), Dune Mini (699), Dune Grand (1299), Aperitivo (2599).
  Official descriptions are used verbatim. One internal standard SKU per product;
  no unconfirmed colour, shape, size or other customer-selectable variants.
- All are handmade to order; approximate production time is 14 days / two weeks.
  A requested date remains a request until the students confirm it.
- Supplied logo `assets/logo-casa-apero.jpg` stays unchanged; an identical copy is
  served publicly. Header, homepage brand area and footer use that image.
  Favicon is a proportionally reduced original. Palette approximates logo colours.
- Official about text describes 8 students, handmade ceramics and their stated
  sustainable approach. No independent certification or extra claim is added.
- Pickup area: Julius en Maurits Sabbestraat, Brugge. Exact location/time by agreement.
  Local delivery around Brugge may be possible, with fees agreed separately.
- Payment is cash or an approved electronic method at pickup/delivery. The specific
  electronic provider remains unconfirmed. No online payments or automatic email.
- Public Instagram/TikTok links are supplied. No actual contact email is present in
  the new brief; publishing an individual's address also needs explicit approval.
  Build-time public email configuration excludes unapproved addresses from output.
- Three future administrators need separate authorized identities in Cloudflare
  Access; none of their names/emails or personal administrative details are public.
- Students target October 29, 2026 for starting sales. This is a business milestone,
  not a promised website release. The enterprise lasts approximately one school year.
- Manufacturing costs of EUR 3–4 per product are an unverified overall estimate.
  Individual costs remain unset. The private admin must configure estimated/actual
  per-product cost, source and effective date; reports must identify estimates and
  missing costs. Never seed an arbitrary EUR 3.50 as confirmed cost.

Still required: real product photos, approved public mailbox, confirmed payment
provider and delivery fees/arrangements, school-approved privacy/retention details,
per-product verified costs and domain registration confirmation.

## Phase 2: real local order workflow

The legal-readiness requirements in [legal-readiness.md](legal-readiness.md)
supersede the earlier confirmation-page-only plan below. No request or binding
checkout may open before seller/cost/privacy approval, durable-medium contract
confirmation and the required online withdrawal process. The current legal pages
are drafts; multiple authorized students need individual least-privilege access.

- Add a Worker entry point and separate local/test/production D1 bindings.
- Migrations for products, variants, ordered photo records, settings, orders and
  immutable order-item price snapshots. Store euro amounts as integer cents.
- Model estimated production time and product/global pauses; do not model stock.
- Seed the four official products and prices from this update, then replace the
  local catalogue module with a public API returning only published product data.
  Financial costs and administrator identities must never be in that response.
- Validate order data and cart IDs server-side, enforce pauses inside the write
  transaction, resolve authoritative prices, and insert order/items atomically.
- Use a unique idempotency key with a request hash; retries return the same result,
  while reusing a key for different data is rejected. Handle submission failures
  without clearing the cart. Never create a success page before a committed order.
- Server-verify Turnstile, including expected action/hostname, and apply rate limits
  where available. Keep development bypasses impossible in production.
- Generate unguessable unique references. Protect order details with an opaque
  access token rather than allowing public lookup by a predictable order number.
- Guest checkout: name, email, optional phone, pickup/delivery preference, optional
  requested date/notes, required conditions acknowledgement. Do not collect a
  delivery address unless it is necessary for confirmed arrangements.
- Confirmation page: easily copied reference, order snapshot and next steps;
  payment at pickup/delivery, arrangements confirmed separately. No automatic email.
- Use prepared queries, explicit payload size/quantity limits and private no-store
  responses. Keep customer details out of logs, public APIs and analytics.

## Phase 3: simple protected administration

- Cloudflare Access on the admin hostname; verify issuer, audience, expiry and JWT
  signature in every private API. Never authorize solely from a client header or
  hidden route. Fail closed if authentication configuration is missing.
- Authorize all three responsible students using individual identities and an
  explicit allowlist; never use a shared hardcoded password in the browser.
- Mobile dashboard with new, confirmed, in-production, ready, completed and cancelled
  orders. Track payment independently as unpaid, paid or refunded.
- Internal notes, agreed pickup/delivery date and location, cancellation workflow.
- Product editing, multiple photos, optional variants, integer prices and costs,
  estimated production times and global/per-product order pauses. Confirm the image
  storage approach and free-tier limits before adding uploads.
- Record payment events idempotently; an order's value is never paid revenue by
  itself. Reflect refunds in net receipts and retain a minimal financial audit trail.
- Separate daily physical sales summaries: product, quantity, date, total revenue,
  optional evidence/reference and notes. No individual customer/payment-method data.
- Online payments and physical summaries have distinct immutable source IDs. Reject
  duplicate summary references/idempotency keys. Provide a correction/reversal flow
  so an already recorded online order cannot be counted again as a physical sale.
- Received revenue, refunded amounts, estimated costs/profit and product popularity.
  Use cost snapshots; label missing costs so profit is not overstated. Keep order
  demand counts separate from paid sales. Physical sales are confirmed receipts.
- Configure manufacturing costs per product in protected administration; store the
  amount in integer cents with an estimate/verified flag and dated snapshots.
  Start all four product-specific costs as null until supplied. Treat EUR 3–4 only
  as the team's unverified general estimate, with clear estimate labels in reporting.
- Excel-compatible CSV: UTF-8 BOM, semicolon separator, proper escaping and spreadsheet
  formula-injection protection. Public analytics never contain customer details.
- Authorized export and customer-data deletion/anonymisation; retention settings
  await school decisions and must not claim an invented legal period.

## Phase 4: launch preparation after explicit approval

- Test Worker API authorization, order idempotency, transactions, validation,
  rate limits, payment/refund accounting, CSV safety and cross-origin protections.
- Separate local and production secrets/data; test fixtures must not leak into the
  live catalogue. Set payload/security headers, private no-store responses and
  explicit host/origin checks for write endpoints. Review Access on every API route.
- Confirm actual products, prices, production time, available payment method,
  contact person, privacy information, retention, arrangements and any delivery costs.
- Document D1 exports/backups, safe storage of personal data, and a tested restore
  into a separate database. CSV exports remain available for school reporting.
- Document school-year shutdown: pause ordering, finish/refund open orders, export
  necessary orders and financial records, backup, verify restore, anonymise/delete
  customer details according to the approved policy, then retire routing and Access.
- Confirm domain registration for casaapero.com. Configure approved hostname and
  admin.casaapero.com separately. Check free-plan limits before creating resources;
  no paid plan may be enabled without approval.
- Obtain approval before a Git push, Cloudflare deployment or public domain change.
  Keep `main` and its GitHub Pages deployment intact until replacement is accepted.
