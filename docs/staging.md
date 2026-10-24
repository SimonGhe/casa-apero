# Online staging preview

URL: **https://casa-apero-staging.simongheneyn.workers.dev**

Worker: `casa-apero-staging`, deployed on 24 October 2026 with the user's explicit
staging-only approval. The existing GitHub Pages site, `main`, production D1,
Cloudflare Access, Turnstile widget and purchased custom domain were not changed.
No production migrations, remote D1 commands, purchases or paid services were used.

## Isolation

`wrangler.staging.jsonc` uses `worker/staging.ts`, an independent static-frontend
handler with no imports of the local order API, database binding or secret.
Only static assets and `APP_ENV=staging` / `CHECKOUT_ENABLED=false` are configured.
All `/api` and `/api/*` requests return 403, regardless of method, flags or missing
settings. There is no code path capable of creating orders. Non-GET/HEAD frontend
requests are rejected. Local checkout/receipt, source, devtool, map and admin URLs
are blocked. The staging frontend omits the local checkout route and its form
module, and does not fetch the local configuration endpoint. Staging has no
Turnstile script, test token, idempotency client or secret in its frontend bundle.
The legal drafts still describe future/local functionality for review.

`assets.run_worker_first=true` applies the Worker safeguards and `X-Robots-Tag:
noindex, nofollow, noarchive` to frontend, asset and rejected API responses.
`robots.txt` disallows all crawling and HTML includes a noindex robots meta tag.
This is public, shareable staging; noindex is not authentication. There is no
customer information or admin functionality to protect with this public preview.
Product photography remains explicitly labelled temporary.

`workers_dev=true`, `preview_urls=false`, no routes/custom domains, and no D1/KV/
R2/service bindings are present. The only resources uploaded are this separate
Worker/version, its static assets and its workers.dev route. There is no database
or migration for staging. The account remains on its existing Free plan.

## Build, verify and redeploy this staging target only

```powershell
pnpm.cmd build:staging
pnpm.cmd test
pnpm.cmd test:e2e
pnpm.cmd test:staging
pnpm.cmd audit
pnpm.cmd exec wrangler deploy --dry-run --config dist-staging/worker/wrangler.json
pnpm.cmd deploy:staging
```

The explicit Vite staging mode selects `wrangler.staging.jsonc` and outputs to
ignored `dist-staging/client` and `dist-staging/worker`. Normal local development
and production-disabled builds retain their existing configuration. The deployment
script validates the generated name, disabled purchase flags, asset routing and
absence of custom routes/databases/services before invoking Wrangler against that
exact generated staging configuration. It does not run a generic deploy command.
Future deployments require the owner's authorization; these commands document
the staging scope and do not authorize production.

To verify the public URL (only empty rejected API payloads are sent):

```powershell
$env:STAGING_URL = 'https://casa-apero-staging.simongheneyn.workers.dev'
pnpm.cmd test:staging
Remove-Item Env:STAGING_URL
```

Without STAGING_URL, the staging browser suite starts the compiled Worker locally
on port 4175. It disables Wrangler's injected local explorer with
`X_LOCAL_EXPLORER=false`, so tests exercise the actual Worker route rejection.
Staging traces/screenshots use ignored `staging-test-results`, separate from the
existing browser suite's output. The public deployment contains no Wrangler dev
server or explorer. Workers source maps are neither emitted nor uploaded.

Validation: TypeScript and staging build passed; 29 unit/integration tests,
36 existing desktop/mobile tests, four local-staging checks and four public-staging
checks passed. Dependency audit: no known vulnerabilities. Live HTTP checks
returned 200 for the homepage, noindex headers, and 403 for empty order requests.
Live tests also cover image loading, official four product prices, cart reload,
legal footer navigation, mobile overflow, robots and forbidden routes.

## Changed staging files

- `wrangler.staging.jsonc`, `worker/staging.ts`, `scripts/deploy-staging.mjs`
- `vite.config.ts`, `package.json`, `.gitignore`
- `src/App.tsx`, `src/components/Layout.tsx`,
  `src/components/LocalRequestLink.tsx`, `src/pages/Legal.tsx`
- `tests/unit/staging.test.ts`, `playwright.staging.config.ts`,
  `tests/staging/preview.spec.ts`
- `README.md`, `docs/staging.md`

Outstanding production blockers remain in `legal-readiness.md` and
`phase-2-local.md`: seller/tax/privacy approval, delivery costs, durable-medium
confirmation, withdrawal process, protected admin, production security and real
product photos. None of those is enabled by this preview.

References checked: [Cloudflare Vite environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/)
and [static asset response headers](https://developers.cloudflare.com/workers/static-assets/headers/).
This project uses a dedicated staging config selected by Vite mode rather than
inheriting production bindings through a shared environment definition.
