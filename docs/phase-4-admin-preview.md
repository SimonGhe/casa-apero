# Phase 4 — secure admin preview, locally prepared

Prepared on `develop`. **No deployment or Cloudflare resource mutation is authorized
or performed in this phase.** The public storefront remains in test mode and its
API still rejects all order requests. Production D1 is not connected or queried.

## Proposed Cloudflare resources

| Component | Proposed configuration |
| --- | --- |
| Admin hostname | `https://admin.casa-apero.com` only |
| Separate Worker | `casa-apero-admin-staging` |
| Separate D1 | `casa-apero-admin-staging`, EU jurisdiction at creation |
| Edge authentication | Existing hostname Access application, authorized-email policy and One-time PIN |
| Origin authorization | RS256 JWT signature/JWKS, exact issuer/AUD, exp/nbf/iat/sub/type and exact allowed email |
| Worker alternative URLs | workers.dev off; preview URLs off; alternate hosts/ports denied by origin check |
| Initial capability | Read-only fictional records; all customer ordering disabled |

The existing `casa-apero.com` → `casa-apero-staging` custom-domain binding must
remain unchanged. Do not run the old storefront deployment command as part of
this phase. Do not attach either `casa-apero-prod` or its UUID to the admin preview.

## Read-only infrastructure observations

- Wrangler is authenticated. The public storefront Worker has only static assets,
  APP_ENV=staging and CHECKOUT_ENABLED=false; it has no database binding.
- The Workers domain list confirms `casa-apero.com` maps to `casa-apero-staging`.
- The D1 metadata list showed only the existing production-named EU database.
  Its contents were not queried or changed. No staging database has been created.
- The initial Access application listing returned an empty list for the current
  account, while the organization request returned HTTP 403. This is not proof
  that the application does not exist; it remains an infrastructure verification
  gap. The owner subsequently supplied the team domain, exact AUD and email.
- The supplied team JWKS URL was checked read-only and returned HTTP 200 with
  two RSA signing keys. Reachable keys do not establish that the audience and
  email policy are active on the intended hostname.
- At inspection time `admin.casa-apero.com` failed DNS resolution from this
  environment. A protected Worker/domain route has not been provisioned here.

These observations do not establish a completed authenticated online deployment.
In particular, no OTP was requested, no real user JWT was obtained or pasted,
and no successful actual Access login is claimed.

## Private environment configuration

The owner-supplied issuer, 64-character AUD and exact authorized email are stored
only in ignored `.env.admin-preview.local`. They are not repeated in committed
documentation, examples, fixtures or frontend code. Git ignore was checked.
This local file must not be shared or committed. Use
`preview/admin-preview.env.example` when setting up another machine.

The file uses server/build-only names:

```dotenv
CASA_ADMIN_PREVIEW_ACCESS_ISSUER=
CASA_ADMIN_PREVIEW_ACCESS_AUDIENCE=
CASA_ADMIN_PREVIEW_ADMIN_EMAIL_ALLOWLIST=
```

The Vite preview mode explicitly maps these to Worker-only ACCESS_ISSUER,
ACCESS_AUDIENCE and ADMIN_EMAIL_ALLOWLIST. It does not use `VITE_*` variables.
Empty/placeholder/invalid values remain empty and fail closed. The generated
Worker configuration contains the server values, so the entire `dist-admin-preview`
directory is ignored and must not be published as ordinary public files. Its
`client` subdirectory contains none of these values. No signing key or OTP secret
is needed in this application; the Worker fetches public signing keys from the
fixed configured issuer. Never accept a JWKS URL or identity from a client field.

## Deployment configuration, not a deployment

`wrangler.admin.preview.jsonc` prepares the exact admin custom domain, separate
Worker name, disabled workers.dev/version previews, no source maps, no request
observability, Worker-first static assets and the dedicated D1 name. Its UUID is
an explicit unprovisioned placeholder. EU jurisdiction is a **database-creation**
setting (`d1 create --jurisdiction=eu` after approval), not a binding property.

APP_ENV=admin-preview and ADMIN_AUTH_MODE=access are required. The initial
ADMIN_WRITES_ENABLED=false is separate from CHECKOUT_ENABLED=false. Enabling
fictional admin edits later cannot activate any order-creation route because
that code is not in the preview entry point. Read-only UI capability is returned
by the authenticated session API; browser controls are disabled accordingly.

Every admin deployment build uses `auth.deployed.ts`. The local HMAC session
signer, cookie verifier and local-login UI are excluded from the built artifacts.
Existing Phase 3 `dev:admin` still supports its explicitly local simulation.
The preview entry authenticates before assets or database access and rejects the
local-login/logout API, development paths, source maps and every public API.
Actual preview logout delegates to Cloudflare Access's `/cdn-cgi/access/logout`.

The isolated database must also contain the exact fictional dataset marker and
only `local_test` orders with `@example.invalid` email addresses. Missing/wrong
marker, wrong flags, missing DB or unexpected order rows produce HTTP 403 before
admin APIs or assets are served. The marker is not a substitute for the dedicated
database and binding review; never run its seed against production.

## Local implementation and tests

Validation completed locally on 24 October 2026: TypeScript; all four builds
(storefront, disabled admin, storefront staging and Access admin preview);
52 unit/integration tests; 36 storefront, 8 local-admin, 4 local-staging and
2 compiled-preview desktop/mobile browser checks. The final storefront rerun
passed unchanged after two receipt checks timed out under concurrent suite load.
The compiled workerd verifier passed authorized 200 / unauthorized 401 / forbidden
403 cases and artifact-leak checks. The dependency audit reported no known
vulnerabilities. Seed/migration rerun was idempotent. Mobile preview output was
visually inspected. Actual Access/OTP authenticated verification remains pending.

```powershell
pnpm.cmd db:admin-preview:local
pnpm.cmd build:admin-preview
pnpm.cmd verify:admin-preview:local
pnpm.cmd test:admin-preview
pnpm.cmd test
```

The local preparation script hard-codes `--local`, the preview configuration,
and `.wrangler/admin-preview-state`. It applies existing migrations 0001–0003
and `preview/admin-fixtures.sql`. It does not use the Phase 2/3 local dataset or
any remote D1 instance. Re-running it is idempotent and leaves purchases paused.

`verify:admin-preview:local` runs the **compiled** Worker in local workerd with
local D1 and real cryptographic fixture signatures. Its outbound JWKS requests
are fulfilled by an in-memory test provider; other external requests fail.
It tests authorized API/assets, unauthorized 401, alternative-host 403, order/
simulated-login denial, read-only capability and built-artifact isolation.

The preview browser tests intercept every virtual admin-host URL and dispatch it
to that same local compiled Worker. No browser request goes to the real hostname.
They cover desktop/mobile navigation, fictional details, absence of the local
login button, read-only controls, reporting and layout. This is a local fixture
test of the authentication path, **not an actual Cloudflare Access/OTP test**.
Fixture private keys and JWTs remain in test-process memory and are never printed.

`dev:admin-preview` can start the strict preview handler on loopback for rejection
checks, but opening localhost will correctly return 403: localhost is not an
allowed deployed origin. Do not introduce a hostname/authentication bypass to
make that browser URL work. Use `dev:admin` for ordinary local editing, or the
compiled fixture tests for preview behavior.

Regression commands remain:

```powershell
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd build:admin
pnpm.cmd build:staging
pnpm.cmd test:e2e
pnpm.cmd test:admin
pnpm.cmd test:staging
pnpm.cmd audit
```

Clear STAGING_URL before the staging test command so it uses its local server.
Do not run admin mutation browser tests concurrently with storefront tests because
they intentionally share the original local-development DB. The new preview
tests and preview dataset are independent.

## Changes requiring explicit approval later

1. Verify the Access application in the correct account: exact hostname (all
   paths), issuer and AUD match the private local configuration; the allow policy
   contains only the approved email, uses One-time PIN and has no Bypass rule.
2. Create the separate EU staging D1 database; replace only the preview placeholder
   UUID. Review the name/UUID against the production database metadata.
3. Apply migrations and fictional seed **only to that approved staging DB**.
   These remote writes have not been run. No production migration is necessary.
4. Deploy only `casa-apero-admin-staging` and attach only `admin.casa-apero.com`.
   Keep workers.dev and version previews disabled and leave the storefront alone.
5. Complete the real authenticated verification below with the owner. The initial
   deployment is a read-only verification candidate, not yet a verified preview.
6. Only after the authenticated result is accepted, consider separate approval to
   enable mutations on fictional staging data. Keep customer ordering disabled.

No admin deployment script is added. The prepared custom-domain configuration
does not itself grant approval to execute Wrangler deploy, D1 create, remote SQL,
DNS/domain binding, policy changes or secret/variable updates in Cloudflare.

## Required actual Access verification before secure acceptance

On the approved deployed preview, use a private/incognito browser session:

- Anonymous direct requests to admin APIs must not return data (401/403 at the
  Worker; Access may intercept first with an OTP/login redirect). HTTP 302 alone
  is not proof of origin JWT enforcement; the local origin tests cover that layer.
- Log in through actual One-time PIN using the approved email, with the user
  entering the PIN locally. Never paste PINs, session cookies or JWTs into chat.
- Confirm `/api/admin/session` returns the expected exact identity, local=false,
  preview=true and writesEnabled=false; load fictional orders, reports and CSV.
- Verify an unapproved identity is denied by the edge policy and server allowlist;
  check alternate/public/workers.dev paths cannot reach customer or admin data.
- Verify expired/malformed/wrong-audience credentials are rejected, the local-login
  API remains denied, logout invalidates browser access and refresh requires Access.
- Verify the storefront still displays its test banner and order POST remains 403.
- Capture a redacted verification record: timestamp, Worker version, test database
  name, policy/app identifiers and pass/fail results. Record no credentials.

Until that record exists, actual authenticated Access verification is **pending**.
JWT fixture success and reachable signing keys must never be presented as its
replacement. Production D1 and real ordering remain out of scope throughout.

## Files

Added: `worker/admin-preview.ts`, shared Access-only and deployed auth modules,
preview dataset guard, `wrangler.admin.preview.jsonc`, fictional seed, local DB/
verification harness scripts, private-config validator/example, unit and compiled
desktop/mobile preview tests and this guide. Updated: Vite mode/build isolation,
admin session capabilities and read-only UI, package scripts and ignores.

Technical sources checked: [Cloudflare JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/),
[D1 EU jurisdiction at creation](https://developers.cloudflare.com/d1/configuration/data-location/),
and [workers.dev controls](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).
