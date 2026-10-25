# Production preparation — 25 October 2026

Production D1 is initialized. No Worker, domain, Access policy or remote secret
was changed. The live storefront and administration still use staging, including
the existing restricted fictional checkout. No Git commit or push was made.

## Verified production database

- Account: `3de40ffeaeffb3488aa83095a9ec55fe`.
- D1: `casa-apero-prod`, UUID `5d4d738b-4d84-4826-a15d-4652e7e191bd`, EU jurisdiction.
- Applied through Wrangler's native `d1_migrations` ledger: `0001_schema.sql`,
  `0002_catalogue.sql`, `0003_administration.sql`,
  `0004_catalogue_presentation.sql`, `0005_test_checkout_ownership.sql`.
- Executed `production/initialize.sql` after verifying the empty database.
- Olive 699, Dune Mini 699, Dune Grand 1299, Aperitivo 2599 euro cents.
- `dataset=production`, `orders_paused=true`.
- Zero orders, items, status history, payment records, financial events/refunds,
  audit entries, market sales/items, idempotency keys and tester ownership rows.
  No `admin_preview_guard` table and no staging data imported.
- A subsequent migration-list check reports no pending migrations.

## Backups and recovery

Ignored local directory: `.wrangler/production-setup-2026-10-25/`.

- `before.json`: live Worker settings, active versions, domains and restrictions.
- `production-empty-before.sql`: pre-initialization SQL export.
- `time-travel-before.json`: pre-migration bookmark
  `00000003-00000004-0000510f-c7383c6cfe7599a733e558e4049085f7`.
- `production-clean-initialized.sql` and `time-travel-after.json`: clean prepared
  database export and recovery point.
- Migration logs, exact source config backups, post-initialization verification,
  compiled-artifact proof and private deployment inputs are retained there.

No data restore is needed now. If initialization recovery is required, inspect
the ledger first; resume unapplied migrations rather than rerunning seeds.
For a reviewed full reset before real orders exist, the recovery command is:

```powershell
pnpm.cmd exec wrangler d1 time-travel restore casa-apero-prod --config wrangler.shop.jsonc --bookmark 00000003-00000004-0000510f-c7383c6cfe7599a733e558e4049085f7
```

This command was NOT executed. Never restore this empty snapshot over later real
customer records, and never restore a fictional staging export into production.
Copy the SQL backups to the school's approved backup location before cutover.

## Prepared Workers and private configuration

| Worker | Build/config | D1 | Activation |
| --- | --- | --- | --- |
| `casa-apero` | `shop` / `wrangler.shop.jsonc` | production UUID above | Orders disabled |
| `casa-apero-admin` | `admin-production` / `wrangler.admin.production.jsonc` | same production UUID | Admin writes disabled |

Both configurations disable workers.dev and preview URLs. Source configs contain
no administrator identities or secrets. No production Worker has been uploaded.

Ignored `.env.shop.local` supplies the existing public Turnstile site key, with
`CASA_PUBLIC_ORDERS_ENABLED=false`, `CASA_LAUNCH_APPROVED=false` and no approved
legal version. A missing Turnstile secret also fails closed. The production
storefront retains TESTVERSIE, hides trial links and rejects `/test-bestellen`.
Its disabled checkout does not show a form, simulate success or store orders.

Ignored `.env.admin-production.local` carries the existing issuer, admin AUD and
four-person administrator allowlist, with writes false. JWT signature, issuer,
audience, expiry, email, hostname and CSRF safeguards remain in the existing code.

The compiled admin upload config
`dist-admin-production/worker/wrangler.production-ready.json` omits the email
variable. Supply the allowlist as an encrypted binding through Wrangler's
`--secrets-file .wrangler/production-setup-2026-10-25/admin-private-bindings.json`.
This upload config must be regenerated from the normal build config after any
rebuild by deleting `vars.ADMIN_EMAIL_ALLOWLIST`; never publish it as a plaintext
variable or frontend constant. All these generated/private files are ignored.

The existing Turnstile secret remains only on `casa-apero-staging`; Cloudflare
does not reveal its value for copying to another Worker. Install it privately on
the new production Worker during an approved cutover. Do not paste it into chat
or commit it. A staged secret version must be checked to include the new code,
production binding and disabled flags before it is activated.

## Coordinated cutover, not performed

1. Approve switching both domains with customer ordering still disabled. Recheck
   active versions and save current staging settings immediately beforehand.
2. Upload the two prepared production builds without moving their custom domains.
   Use the private admin secret file and install the public Turnstile secret.
   Verify production UUID, false activation flags, server-only secrets, exact
   admin issuer/AUD/allowlist and disabled alternative hostnames.
3. Disable restricted test submissions on the existing public staging Worker
   before moving admin. Preserve all existing staging bindings and history.
   This prevents fictional orders arriving in staging while admin shows production.
4. Activate the reviewed production versions with all ordering/write flags still
   false. Move admin.casa-apero.com and casa-apero.com to their respective
   production Workers as one coordinated operation. Keep Access policies intact.
   Do not remove a working domain before its replacement Worker is ready.
5. Check public availability, TESTVERSIE, no tester links, disabled order APIs,
   zero production transactions and an actual authorized Access browser login.
   No production test orders: the full workflow is already verified locally.
6. Enable production admin writes only after verified authentication and separate
   approval. Customer ordering remains disabled pending school/Vlajo approval,
   approved seller/legal/privacy information, confirmation process and explicit
   launch approval. Do not enable the flags or resume the database ordering pause
   as a side effect of this infrastructure switch.

If cutover fails, disable submissions and restore both domain assignments to the
recorded staging Workers. At this preparation point their versions are:

- Public: `62185663-a876-4df3-86e6-dcf9116387c1`.
- Admin: `9455748e-5def-4b67-8d7e-da77fbe5116b`.

Recheck these versions at cutover. Restore the public test-ordering flag only if
resuming the previously approved fictional trial is explicitly desired. Preserve
both databases; routing rollback does not require a database restore.

## Focused validation and owner actions

- TypeScript and `build:shop` / `build:admin-production` passed.
- Eight existing public-shop/authentication tests passed.
- Two existing compiled desktop/mobile public workflows passed, using only local
  fictional data: order, receipt, admin confirmation, payment, production,
  collection and reports.
- An isolated compiled-build check confirms correct production bindings, private
  four-admin configuration, no simulated deployed login, TESTVERSIE, no trial
  links, disabled submission APIs returning 403 and zero locally created orders.
- Remote production counts/prices/ledger verified; live staging versions,
  bindings, domains and alternate-host restrictions unchanged.
- Live public site HTTP 200; ordinary order submission HTTP 403; admin Access
  redirect intact. No staging D1 mutation or Access policy change was performed.

Owner actions: approve the disabled-ordering production cutover when desired and
install the Turnstile secret privately at that time. For accepting customer
orders, obtain the school/Vlajo decision and approved business/legal/confirmation
information. If Vlajo Market is mandatory, provide the approved Market URL;
keep this website's submission APIs disabled. No sales-channel approval or legal
identity has been invented.
