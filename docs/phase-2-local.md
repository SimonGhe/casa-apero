# Phase 2 — local requests and D1

The registered domain is **casa-apero.com**, through Cloudflare. It has not been
connected, deployed or published by this work. `main` remains untouched.

## Run and demonstrate (Windows PowerShell)

Use Node.js 24 LTS and pnpm. From `G:\Programming\sites\casa-apero`:

```powershell
git status -sb
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:migrate
pnpm.cmd dev
```

Keep that terminal running. Open `http://127.0.0.1:5173`, add products to the
cart, choose **Naar bestellen**, then **Test het lokale bestelformulier**.
Direct local form: `http://127.0.0.1:5173/bestellen/lokaal`.
Use an invented name and an address such as `test@example.invalid`, no real data.
Optional phone, requested date and notes work; a requested date is not promised.
The server rechecks all prices and ordering pauses. After submission the receipt
shows a `TEST-…` reference and the stored product snapshot; the cart is cleared
only after a successful API response. Reloading the receipt reads D1 again.

For a reproducible CLI demonstration, in a second terminal:

```powershell
pnpm.cmd demo:order
pnpm.cmd db:inspect
```

The demo creates only synthetic data: 2 Olive + 1 Aperitivo, product subtotal
3997 cents. It repeats the submission with the same key and asserts the same
reference, no contract and unknown delivery/final total. Its random receipt
capability is saved in ignored `.wrangler/demo-receipt.json`; do not share it.
Stop the dev server using Ctrl+C, restart `pnpm.cmd dev`, then:

```powershell
pnpm.cmd demo:verify
pnpm.cmd db:migrate
```

`demo:verify` reads the saved request from the restarted local D1. Reapplying
migrations is safe: Wrangler tracks applied versions. Do not delete `.wrangler`
if you want to retain local demo data. All of it is disposable synthetic data.
Do not run migrations with `--remote` or create a production DB for this phase.

## Validation

Verified on 24 October 2026: TypeScript and production build passed; 26 unit/
integration tests and 36 desktop/mobile browser tests passed; dependency audit
reported no known vulnerabilities. Existing 12 unit and 26 browser tests remain.
Migrations applied successfully and a second apply reported no pending migrations.
CLI demo `TEST-BFB8F3FEA0EC41AA` totalled 3997 cents; duplicate submission returned
the same reference and `demo:verify` passed after restarting the development
server. The production preview returned `localRequests: false` and HTTP 403 on
submission. Mobile checkout screenshots were inspected. No deployment occurred.

```powershell
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd test
pnpm.cmd exec playwright install chromium  # only if browser is not installed
pnpm.cmd test:e2e
pnpm.cmd audit
```

Run `db:migrate` before browser tests. Playwright starts/reuses the loopback Vite
server. Unit/integration tests use separate Miniflare D1 instances; restart
persistence tests use UUID-isolated `.wrangler/test-persistence` directories.
Browser tests write synthetic requests to the local development DB, never a
remote database. Existing tests are retained.

`pnpm.cmd build` emits `dist/client` and `dist/worker`, not the old single `dist`
SPA layout. `pnpm.cmd preview` previews the production-disabled configuration;
there is no working request form in that mode. Do not deploy either configuration.

## Configuration and local/public separation

The official Cloudflare Vite plugin runs Worker code in local `workerd` with
static assets and SPA routes. `vite.config.ts` selects `wrangler.local.jsonc`
only for the development server. Normal builds/previews use `wrangler.jsonc`:

| Configuration | Requests | D1 | Domains |
| --- | --- | --- | --- |
| Local dev | Non-binding synthetic requests on loopback only | Local simulated binding, `remote: false`, placeholder ID | No routes; `workers_dev` and previews off |
| Build/production default | Denied server-side | No DB binding | No custom domain or route; workers.dev and previews off |

All order APIs fail closed unless `APP_ENV=local`, a DB binding exists and the
request URL hostname is `127.0.0.1`, `localhost` or `[::1]`. An accidental local
configuration upload would still reject requests to public hostnames. No binding
is inherited from local into the disabled build. There is no deploy script.
The default preview/storefront legal safeguards remain inactive at `/bestellen`.
The separate local route adds a synthetic request test, not a binding purchase.

Dependencies are locked. Native postinstall scripts are allowed only for esbuild
and workerd. The direct Miniflare dependency matches Wrangler's runtime version;
its v4 option adapter is used by tests. `undici` is overridden to patched 7.30.1
because the Cloudflare dependency initially resolved 7.29.1 with audit findings.
Recheck the override and remove it when upstream no longer needs it.

## Database and transaction design

Versioned SQL migrations create products, application settings, orders, order
items, status history, payment status, idempotency keys and local rate limits.
The catalogue seed contains exactly Olive 699, Dune Mini 699, Dune Grand 1299 and
Aperitivo 2599 cents, with fourteen production days and no stock model.
No costs are invented: product/order-item cost snapshots are nullable.

Every new order is a **request**: `request_status=received`,
`contract_status=none`, `production_status=not_started`, `source=local_test`,
payment `unpaid`. Delivery and final totals are NULL, not zero. Product subtotal
is exact integer cents. Future confirmation requires a known total, contract
timestamp and durable-confirmation timestamp at database level. This is a data
integrity constraint, not a claim that the legal approval process is implemented.

A D1 `batch()` transaction inserts the order, server-priced/name/production/cost
item snapshots, initial history, unpaid status and unique idempotency entry.
The order INSERT checks global/product pauses, published products, variants,
matching line count and expected subtotal inside the same transaction. Foreign
keys and checks roll back all writes on failure. No client price is authoritative.
The quote endpoint is for display; acceptance is rechecked at write time.

Idempotency keys are UUIDs. SHA-256 of normalized request data (including the
random receipt capability) distinguishes a retry from conflicting reuse. Replays
return the original committed snapshot before attempting to redeem Turnstile
again. Concurrent submissions use a unique DB key; a losing batch rolls back
and reads the winner. Keys last with the local synthetic order; production
retention/deletion remains to be approved. Never clear an ambiguous submission
and silently use a new key.

## API contract

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/config` | GET | Non-sensitive local capability and optional public test sitekey |
| `/api/products` | GET | Published D1 names/prices/production time/pauses, no costs or private data |
| `/api/quote` | POST | Validated selection, D1-priced lines and product subtotal |
| `/api/requests` | POST | Local synthetic request; `Idempotency-Key` plus receipt capability in JSON |
| `/api/receipt` | POST | Requires `Authorization: Bearer <256-bit receipt capability>`; no customer fields returned |

All API responses use JSON, `no-store`, `nosniff` and `no-referrer`; API misses
remain JSON even for browser navigation. No order listing, customer search,
reference-only lookup, admin endpoint, contract confirmation or status mutation
is exposed. Receipt capabilities are SHA-256 hashed in D1. UUID references are
not access credentials. Do not place capabilities in URLs or logs.

POST requires exact same-origin `Origin`; cross-site fetches are rejected.
No CORS headers are enabled. Input is bounded to 16 KiB, four distinct lines,
1–99 integer quantities, name 100 characters, email 254, optional phone 40 and
notes 1000. Dates must be real dates no earlier than today in Brussels. SQL uses
prepared bindings; server responses never include SQL details or customer fields.

All local POST routes share a DB-backed 120-per-minute loopback-host limit.
Expired buckets are removed. This is a local abuse/retry bound, not a production
IP security design. Before release, select a supported Free-compatible edge
rate-limiting approach with verified request identity and account limits. Do not
trust browser-supplied IP headers. There are no unauthenticated admin exceptions.

## Browser state and recovery

The form stores no customer fields in localStorage/sessionStorage. Fields are
in component memory only. The cart remains in its four-hour localStorage record.
Only the random capability is stored in `sessionStorage` as
`casa-apero.local-receipt` to restore a receipt within this tab. This is necessary
for the requested local receipt function, not tracking. Closing the tab or
clearing website data loses that browser access; there is no reference lookup
or automated recovery email. Losing the capability does not delete D1 data.

After a network/ambiguous 503 failure, keep the immutable attempted payload and
idempotency key in memory, disable edits and offer **Dezelfde aanvraag opnieuw
proberen** or receipt checking. A successful retry clears the cart. Known input,
challenge, availability and pricing errors unlock editing; pricing is refreshed.
Reloading loses that in-memory retry state: check `/bestellen/ontvangen` with the
saved capability before starting another request. Cross-reload draft/retry
recovery is a launch blocker, not a reason to store customer data in browser
storage without reviewing privacy/retention.

## Turnstile

Default `TURNSTILE_MODE=local-mock` is deliberately deterministic and offline.
Only the server's local+loopback gate accepts `local-test-token`; production
mode cannot use the mock. This is not represented as real bot protection.

For an optional actual Cloudflare test-widget integration, copy
`.dev.vars.example` to ignored `.dev.vars`, uncomment the Siteverify mode and
public test keys, then restart the development server. Only the local form loads
the external script in that mode. Server verification posts to Siteverify with
an eight-second timeout. Real `siteverify` mode requires success, exact hostname
and action `order-request`. Missing configuration, expired/failed tokens,
mismatched metadata and network errors fail closed. The explicit
`siteverify-test` mode accepts Cloudflare's synthetic metadata only when using
the known public passing test secret on local+loopback. It cannot be used in
disabled/public mode. A direct live dummy-token check returned success with
`hostname=example.com` and no action; those synthetic values are not suitable
for real hostname/action validation. Server-side tests cover both strict real
validation and the restricted public-test-key mode. The deterministic browser
suite requires local-mock mode. A live widget round trip is optional and not
claimed by the offline suite. Production secrets and real keys are not included.

## Phase 3 foundation and launch blockers

The schema separates request, contract, production and payment states and records
status history with an actor identifier. It has source classification and nullable
cost snapshots for future physical-sale summaries and accurate financial reports.
Reports must exclude unconfirmed requests from sales/revenue, distinguish paid
receipts/refunds, and mark unknown costs rather than assuming profit. No stock is
deducted. CSV exports will need authorization and spreadsheet-formula escaping.
Add physical-sale/refund/withdrawal records via new migrations when implementing
their complete workflows. Do not reuse the local-test endpoint as an admin API.

Outstanding before real requests or purchases:

- Approved seller identity, business/tax/address/contact information, privacy
  responsibility, processor contracts, retention/deletion and school-year closure.
- Delivery/return charges and arrangements, payment method and reviewed legal texts.
- Documented separate offer/acceptance/contract steps and actual durable-medium
  confirmation, including delivery evidence. No automated emails implemented.
- Online withdrawal submission and durable acknowledgements, with protected access.
- Individual Cloudflare Access identities, verified JWTs on all future private
  APIs, least-privilege roles, status audit and privacy-request handling.
- Production Turnstile configuration, verified hostname/action, rate limiting,
  secret provisioning and a fresh production storage/network/security review.
- Server-side session/retry recovery design for interrupted real submissions.
- Real product photos and separately approved production DB/domain/deployment plan.

No paid resources, remote DB commands, production modifications, emails, online
payments, public purchases or deployment were introduced.

## Changed-file map

- Infrastructure: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
  `vite.config.ts`, `tsconfig.worker.json`, `wrangler.jsonc`,
  `wrangler.local.jsonc`, `.dev.vars.example`.
- Database: `migrations/0001_schema.sql`, `migrations/0002_catalogue.sql`.
- API: `worker/index.ts`, `worker/validation.ts`, `worker/turnstile.ts`,
  `shared/orders.ts`.
- Client: `src/pages/LocalCheckout.tsx`, `src/components/LocalRequestLink.tsx`,
  `src/components/Turnstile.tsx`, `src/lib/orderApi.ts`, `src/App.tsx`,
  `src/pages/StaticPages.tsx`, `src/pages/Legal.tsx`,
  `src/context/CartContext.tsx`, `styles.css`.
- Demonstration/tests: `scripts/local-demo.mjs`, `tests/unit/orders.test.ts`,
  `tests/browser/orders.spec.ts`.
- Documentation: `README.md`, `docs/implementation-plan.md`,
  `docs/legal-readiness.md`, `docs/phase-2-local.md`.

## Official technical references checked on 24 October 2026

- [Cloudflare React SPA/Vite tutorial](https://developers.cloudflare.com/workers/vite-plugin/tutorial/)
  for plugin integration, Worker environment, static assets and API routing.
- [Cloudflare local development](https://developers.cloudflare.com/workers/local-development/)
  for local runtime/bindings and remote-binding distinction.
- [D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)
  for database-enforced relationships.
- [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/)
  for atomic prepared-statement batches.
- [Turnstile server validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
  and [test keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).
