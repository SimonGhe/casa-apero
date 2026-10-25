# Phase 6 — authenticated fictional checkout on the main domain

Review date: 25 October 2026 (Europe/Brussels). Local preparation on develop,
starting from checkpoint `c047a77`. **No deployment, remote D1 query/mutation,
Access change, commit or push was performed during this review.** Existing
storefront/admin deployments remain unchanged. Real customer orders stay off.

## Result and reload diagnosis

The earlier compiled-browser failure was a locator failure, not lost database
data. The admin's team-note textarea wraps inside a label. Once the textarea is
prefilled on reload, exact `getByLabel` matching did not find the same control.
The checkpoint already replaces that locator with
`getByRole('textbox', {name:'Notitie voor het team', exact:true})` and waits for
the reopened order heading. The desktop/mobile compiled journey now verifies
the saved note after reload, without weakening persistence assertions or changing
admin application behavior.

An additional SQLite upgrade regression snapshots all existing business tables,
including completed legacy orders, payments, financial events, audit/history,
idempotency records and edited product prices. Applying migration 0005 leaves
every existing row identical; integrity/foreign-key checks pass, historical
699-cent item snapshots remain 699 while the current product can cost 799.

Final full-suite validation on the normal project toolchain:

| Check | Result |
| --- | --- |
| Unit/integration/security (14 test files) | 101 passed, including 23 checkout cases and the new migration-preservation case |
| Storefront desktop/mobile browsers | 48 passed |
| Local admin desktop/mobile browsers | 8 passed |
| Compiled public staging desktop/mobile browsers | 4 passed |
| Compiled Access admin-preview desktop/mobile browsers | 10 passed |
| Compiled test checkout + existing admin desktop/mobile browsers | 8 passed |
| Total | **179 passed; zero unresolved test failures** |
| TypeScript | Passed standalone and in all builds |
| Builds: storefront, admin, public staging, admin-preview, test-checkout | All five passed |
| Checkout artifact isolation/private configuration verifier | Passed (disabled/unconfigured candidate; not an enabled-deployment assertion) |
| Compiled admin JWT/JWKS/artifact verifier | Passed |
| Dependency audit | No known vulnerabilities |
| Whitespace check | Passed |

The first build encountered a Windows Application Control native-loader error.
The normal toolchain subsequently succeeded without a system-policy or project
dependency-file change. A separate ignored WASM-tooling diagnostic was not used
for the successful validation; no project dependency reinstall was needed.
Existing tests and committed application changes were preserved. This resume adds
only the migration regression, this report and its README link. The verified
checkpoint's application/locator code did not require another change.

Local implementation is ready for deployment/configuration review. The checked-in
release remains disabled; deployment approval, verified staging
Turnstile configuration and real post-deployment authentication tests remain
gates before calling the online flow ready.

## Proposed configuration for owner review

| Item | Proposed value / behavior |
| --- | --- |
| Public domain/Worker | Existing `casa-apero.com` / `casa-apero-staging` |
| Public browsing | Home, products, cart and draft legal pages remain public |
| Protected test pages | `/test-bestellen`, `/test-bestellen/`, `/test-bestellen/ontvangen` |
| Protected test API | `/test-bestellen/api/config`, `/catalogue`, `/quote`, `/requests`, `/receipt` |
| Other API paths | Ordinary `/api/*`, including old order APIs and all public admin paths, remain HTTP 403 |
| New Access application | Self-hosted `Casa Apero Test Checkout`, restricted to `casa-apero.com/test-bestellen` and its descendants |
| New tester policy | Allow exact email `<approved tester email>` only, as approved in this conversation; OTP, proposed session duration 1 hour |
| Audience | Dedicated checkout AUD supplied by owner; stored in ignored server-only local configuration, distinct from the admin AUD |
| Issuer | Confirmed team `https://restless-dust-d9a6.cloudflareaccess.com`; verify against the new application during approved setup |
| Existing admin | `admin.casa-apero.com` / `casa-apero-admin-staging`; existing Access application, allowlist and identity providers unchanged |
| D1 binding | `DB` -> `casa-apero-admin-staging`, EU, UUID `f8c58abc-95ab-4fd9-8279-5f0f0f2ada83` |
| Migration | Only pending `0005_test_checkout_ownership.sql`, via migration ledger after backup |
| Real purchases | `CHECKOUT_ENABLED=false` always |
| Fictional submissions | Separate `TEST_CHECKOUT_ENABLED`, false by default; true only in the separately approved configured release |
| Turnstile | Real staging widget permitted on `casa-apero.com`; backend Siteverify requires exact hostname and action `order-request` |
| Alternate hosts | Public browsing on existing workers.dev may remain; checkout rejects every origin except `https://casa-apero.com` |
| Worker previews | Public Worker preview URLs false; admin workers.dev and previews remain false |
| Logging/fulfilment | No request bodies, JWTs or contact details logged; no mail/payment/fulfilment transport is added |

The recommended Access application protects one path prefix, so pages and APIs
use the same checkout application audience. Cover the prefix itself **and all
descendants**; verify both `/test-bestellen` and `/test-bestellen/api/requests`
in the dashboard/path tests. Do not protect the whole public hostname. Do not
create a bypass, Everyone rule, service-token policy, public override or nested
application with a weaker policy. More-specific Access paths can override a
parent policy; inspect overlaps before approval. This follows Cloudflare's
[path-scoped application guidance](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/).

### Access configuration follow-up — 25 October 2026

The owner supplied the dedicated checkout AUD and confirmed team/hostname/path.
They are mapped to `CASA_TEST_CHECKOUT_AUDIENCE` and the HTTPS
`CASA_TEST_CHECKOUT_ISSUER` in ignored `.env.test-checkout.local`. The admin AUD is
retained separately only to detect/reject reuse. `CASA_TEST_CHECKOUT_ENABLED`
remains false, the staging Turnstile site key remains unconfigured, and no secret
was requested, read, copied or placed in build variables. No deployment or
Cloudflare resource/policy mutation is included in this follow-up.

Anonymous public HTTP checks verified 302 redirects for `/test-bestellen`, its
trailing-slash variant, `/ontvangen`, `/api`, `/api/config`, `/api/catalogue`,
`/api/quote`, `/api/requests`, `/api/receipt` and an unknown API descendant (all
relative to `/test-bestellen`). POST checks on quote/creation/receipt used empty
JSON and were also redirected before reaching a backend. Every redirect targeted
the confirmed team and its `kid` parameter matched the supplied checkout AUD.
No login redirect was followed, no cookies/JWTs were collected and no order was
created. The public homepage returned 200; ordinary `/api/requests` POST remained
403. Sanitized local evidence: `.wrangler/phase6-access-verification/anonymous-paths.json`.

The test-checkout build/TypeScript and artifact isolation verifier passed with the
supplied server configuration. Explicit artifact assertions verified the exact
checkout AUD/HTTPS issuer, a different admin AUD, both ordering flags false and
no Turnstile secret in build vars. The client bundle contains none of the private
configuration values.

This confirms anonymous path coverage and routing to the same Access application.
It does **not** verify the actual Allow policy, authorized/unauthorized OTP login,
runtime backend authorization of a live token, or real Turnstile configuration.
Those remain final deployment gates. The later deployment procedure below still
applies, but inspect/reuse the now-existing checkout application; do not create
a duplicate application or modify it without approval.

An admin cookie/session is not checkout authorization. The Worker verifies the
checkout JWT signature through the configured issuer's JWKS, issuer, audience,
expiry, issued-at/not-before, application token type, subject and exact allowed
email. It explicitly refuses configuration that reuses the admin audience.
Missing/forged/expired/unauthorized credentials fail closed. Identity headers and
client capability flags confer no authority. See Cloudflare's
[JWT verification guidance](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/).

## Local implementation and safeguards

- `worker/test-checkout.ts` is the new optional staging entry point. It reuses
  authoritative pricing/order creation and the existing public deny-all-API
  staging handler. The original staging config/entry point is unchanged.
- `wrangler.checkout.preview.jsonc` targets only the existing public staging
  Worker and fictional EU database. It defaults disabled/unconfigured. It does
  not declare or transfer domains or bind production. `remote:false` prevents
  development from selecting a remote database through the binding.
- Tester config comes from server-only `CASA_TEST_CHECKOUT_*` variables. A real
  Turnstile secret belongs in a Worker secret, not build vars or frontend code.
  The artifact verifier checks exact Worker/DB isolation and private/client
  boundaries; `--configured` additionally rejects disabled/incomplete settings.
- Customer name/email/phone/note are fixed fictional presets. Attempts to send
  arbitrary real contact data or notes are rejected server-side. Only product
  selection, quantities, pickup/delivery preference and a valid requested date
  are editable. No customer login email is copied into customer fields.
- Orders retain `source=local_test`, a TEST reference, `contract_status=none`,
  new workflow and unpaid payment status. The existing admin fictional-dataset
  guard accepts them and existing admin workflow APIs manage them. Simulated
  production/payment statuses are records only; there is no real fulfilment or
  payment mechanism.
- Creation of the order, price/cost snapshots, initial history/payment rows,
  tester ownership, idempotency record and creation audit is one D1 transaction.
  Audit failure rolls back the entire creation. Existing historical rows are not
  repaired/reseeded/rewritten.
- Retries are scoped to a hash of the verified tester subject. A repeated
  successful payload returns its original receipt; changed payloads conflict.
  Concurrent submissions create one order/audit. A receipt also requires its
  opaque capability **and** the owning authenticated tester. Other testers and
  the public cannot look up customer data by reference.
- Same-origin Origin/Sec-Fetch-Site checks protect writes; JSON/body/input bounds,
  prepared SQL, authoritative quote/atomic price checks, global/product ordering
  pauses, no-store/private responses and restricted CORS remain enforced.
  Rate counters use hashed subjects, not client IP or identity headers.
- New submissions always validate Turnstile on the server. Known successful
  idempotent retries return the existing result without redeeming a token twice.
  Turnstile tokens are short-lived and single-use; bad hostname/action, expired
  or reused token and transport failure deny creation. No deployed mock mode is
  accepted. [Official Siteverify requirements](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
- The public catalogue remains a frozen reviewed snapshot. Inside the protected
  checkout a fresh product-only D1 projection and server quote are used. Price
  drift requires a new acknowledgement, pauses block submission, unpublished
  items require cart correction. Never write snapshot prices back to D1.
- Browser tests intercept every main/admin-domain and Turnstile URL, use locally
  signed JWT/JWKS and Siteverify transport fixtures, and dispatch to local
  compiled workerd Workers sharing one local D1. They do not log in to live
  Cloudflare, send OTPs or query remote databases. Unexpected external traffic
  fails the fixture. They are not proof of online Access/Turnstile setup.

## Exact local verification

Run from `G:\Programming\sites\casa-apero` with Node/pnpm installed. Do not use a
remote STAGING_URL while running the local suite:

```powershell
Remove-Item Env:STAGING_URL -ErrorAction SilentlyContinue
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd build:admin
pnpm.cmd build:staging
pnpm.cmd build:admin-preview
pnpm.cmd build:test-checkout
pnpm.cmd verify:admin-preview:local
pnpm.cmd verify:test-checkout
pnpm.cmd test:e2e
pnpm.cmd test:admin
pnpm.cmd test:staging
pnpm.cmd test:admin-preview
pnpm.cmd test:test-checkout
pnpm.cmd audit
git diff --check
```

The browser scripts for storefront/admin run migrations with `--local` and the
hard-coded local config. Run these two suites sequentially because they share
the development database. Compiled fixtures use isolated local databases.

## Deployment steps — proposal only, separate approval required

1. Owner reviews this configuration, approves the new checkout Access application
   and exact tester policy, staging widget use, and the public Worker staging-D1
   binding. Obtain an approved develop commit/clean tree. Capture current Worker
   versions, bindings, domains, secret names (not secret values) and dataset
   metadata immediately before deployment. The Phase 5 public rollback version
   was `4a0247d7-4d93-4910-9ba1-b1126343e994`; admin was
   `b033e430-332e-4431-82ff-4d5228bd71fa`. These are historical references,
   not a fresh online inspection in this local review.
2. Verify the current staging UUID/EU jurisdiction and fictional marker/data.
   Confirm only 0005 is pending and 0001–0004 are already in the ledger. Stop on
   a binding, ledger, real-data or authorization mismatch. Arrange a quiet admin
   editing window. No fixture import/reseed is part of deployment.
3. Create the approved path-scoped Access application/policy using the existing
   OTP provider. Record the new exact AUD. Verify anonymous requests to both the
   prefix and API descendants enter Access, while the rest of casa-apero.com is
   public. Leave existing admin Access untouched. No insecure bypass to diagnose
   missing permissions is permitted.
4. Export this exact staging D1, record a fresh Time Travel bookmark, restore the
   SQL export locally and verify integrity/FKs and historical-table snapshots:

```powershell
$phase6Backup = Join-Path (Get-Location) ('.wrangler/backups/phase6-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $phase6Backup
pnpm.cmd exec wrangler d1 export DB --remote --config wrangler.checkout.preview.jsonc --output "$phase6Backup/before-0005.sql"
pnpm.cmd exec wrangler d1 time-travel info DB --config wrangler.checkout.preview.jsonc --json > "$phase6Backup/time-travel.json"
pnpm.cmd exec wrangler d1 migrations list DB --remote --config wrangler.checkout.preview.jsonc
```

   Run commands individually; stop on any failure. Keep exports/config/logs
   private. Repeat the historical-table comparison after migration, excluding
   only the intentional migration-ledger/schema additions:

```powershell
pnpm.cmd exec wrangler d1 migrations apply DB --remote --config wrangler.checkout.preview.jsonc
```

   Only `0005_test_checkout_ownership.sql` may be applied. Never run a migration
   file manually via `d1 execute --file`, delete ledger rows or import seed data.
5. Verify/configure the staging Turnstile widget on `casa-apero.com`. Set the
   real secret interactively, never by pasting it into chat, shell history or
   frontend variables:

```powershell
pnpm.cmd exec wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.checkout.preview.jsonc
```

6. Put the reviewed server configuration in ignored `.env.test-checkout.local`
   (or equivalent temporary build environment). Do not commit actual config.
   Values to supply:

```dotenv
CASA_TEST_CHECKOUT_ENABLED=true
CASA_TEST_CHECKOUT_ISSUER=https://restless-dust-d9a6.cloudflareaccess.com
CASA_TEST_CHECKOUT_AUDIENCE=<new exact checkout application AUD>
CASA_TEST_CHECKOUT_ADMIN_AUDIENCE=<confirmed existing admin AUD, used only to reject audience reuse>
CASA_TEST_CHECKOUT_ALLOWED_EMAILS=<approved tester email>
CASA_TEST_CHECKOUT_TURNSTILE_SITE_KEY=<real staging widget public site key>
```

   The checked-in config keeps `CHECKOUT_ENABLED=false`; do not change it.
   Do not add a TURNSTILE_SECRET_KEY to build vars/.env/VITE_*.
   Build, inspect and fingerprint the candidate; repeat local tests on that
   candidate. Fixture tests supply their own local JWT/Turnstile config without
   sending the real configuration to an external service:

```powershell
pnpm.cmd build:test-checkout
pnpm.cmd verify:test-checkout
node scripts/verify-test-checkout-artifact.mjs --configured
pnpm.cmd test:test-checkout
```

7. Compare the reviewed frozen public catalogue to current authoritative staging
   products; stop and review drift rather than overwriting edited products.
   Confirm existing pauses; do not silently resume them. If the global pause is
   active, an authorized administrator must explicitly approve and perform a
   fictional-staging resume before testing. Public real orders still stay off.
   Verify the live secret exists, no source maps/test harness/dev auth are
   published, exact D1 binding is staging-only, assets run through the Worker,
   checkout audience differs from admin, and no unexpected resource bindings.
8. Deploy **only** the reviewed public test-checkout artifact:

```powershell
pnpm.cmd exec wrangler deploy --config dist-test-checkout/worker/wrangler.json
```

   Do not use `pnpm deploy:staging`: that deliberately publishes the old
   deny-all-API Worker and has no D1 binding. Do not deploy `dist/`, `dist-admin/`
   or generic disabled configurations. Existing casa-apero.com custom-domain
   mapping is retained; no domain transfer/DNS change is proposed. The existing
   admin Worker already manages local_test records, so **no admin Worker deploy
   is required** for this phase. If that assumption fails, stop for a revised
   separately approved plan rather than widening the deployment.
9. Capture the new version and verify online before declaring the release ready:
   public browsing/prices/banner on desktop/mobile; ordinary order APIs 403;
   anonymous checkout Access redirect/denial; unauthorized email denied; direct
   workers.dev and version-host checkout denial; missing/forged/expired/admin-AUD
   JWT denial; actual separate checkout OTP and real Siteverify success/failure;
   fictional submission/receipt/reload/lost-response retry without duplicates;
   receipt ownership; admin OTP and management of the created fictional order;
   unchanged historical prices/payments/audits and exactly the intended new
   audit entries. Never send real customer details, emails, payments or fulfilment.

   Do not treat local JWT/JWKS/Siteverify fixtures as online proof. Keep the
   checkout disabled or roll back on a failed live authorization/isolation gate.

## Rollback and kill switch — not executed

Fast recovery restores the captured previous public Worker version. If the
preflight confirms Phase 5 is still the previous version, the command is:

```powershell
pnpm.cmd exec wrangler rollback 4a0247d7-4d93-4910-9ba1-b1126343e994 --name casa-apero-staging --config wrangler.staging.jsonc
```

Use the newly captured version if it differs; do not blindly use an old ID.
This restores the public TESTVERSIE/deny-all-API storefront. Recheck 403s, domain
mapping and bindings afterward. The admin is unchanged. Leave additive migration
0005 and fictional test/audit records in staging; code rollback does not restore
D1 and there is no reason to discard intervening student edits.

An alternative reviewed kill switch is `CASA_TEST_CHECKOUT_ENABLED=false`, then
rebuild, run the structural artifact verifier (not `--configured`) and deploy
that disabled candidate after approval. The existing staging-only build is also
a deny-all-API recovery option. Do not remove authentication to keep tests running.
Retain the new Access app or disable its Allow policy only after separate owner
approval; never alter the admin policy as part of recovery.

If a database recovery is necessary, first stop staging activity, export its
current state and obtain explicit recovery approval. Restore **only** the fresh
pre-0005 staging bookmark recorded above, understanding that all later edits
would be lost. Do not improvise production access, destructive imports, column
drops, audit deletion or ledger manipulation.

## Release boundaries and approvals still required

- The code is locally prepared; it is not enabled online. The checkout Access AUD
  is now supplied and anonymous path coverage verified. Staging Turnstile and
  final deployment/authentication safeguards still require verification.
- Owner must approve the new path-scoped application/policy and deployment,
  then complete real OTP/Siteverify and main-domain desktop/mobile checks.
- Authoritative prices live in D1; the public snapshot still needs a publication
  policy. This phase does not claim live public-catalogue synchronization.
- A tester identity hash is pseudonymous access/audit data; it is not anonymous.
  Use the approved school access/retention process. No real customer fields are
  accepted by this test flow.
- Eventual real launch requires a separate production configuration/admin plan,
  legal and school approval, real confirmation/privacy/withdrawal processes,
  and the separate empty EU `casa-apero-prod` database. Do not migrate or copy
  fictional orders/payments/financial/audit transactions into production.
