# Production order-request activation

The owner explicitly authorized removing the application business-approval gate
and deploying real, non-binding pickup requests while incomplete documents remain
labelled as drafts. Teacher permission to receive order forms was supplied by
the owner. This is not a statement that seller details, privacy information or
legal documents have been approved.

## Deployed versions

| Domain | Worker | Version |
| --- | --- | --- |
| casa-apero.com | casa-apero | `2e265587-5b37-41ca-9bb4-4930af321e73` |
| admin.casa-apero.com | casa-apero-admin | `0212859e-14a6-4bef-b32c-e0b1a4a1e73e` |

Both use only EU `casa-apero-prod`, UUID
`5d4d738b-4d84-4826-a15d-4652e7e191bd`. No migrations, prices, Access policies,
domains, paid services or staging resources were changed by this activation.
Production secrets were inherited encrypted; no Turnstile secret was retrieved,
printed or written into a new plaintext file.

## Behaviour and safeguards

- `PUBLIC_ORDERS_ENABLED=true`; `ADMIN_WRITES_ENABLED=true`; the global ordering
  pause was lifted using a version-guarded update and a `settings.pause` audit
  entry (`7aeca908-89a9-4483-9030-5229479111e2`).
- `LAUNCH_APPROVED` and the approved-document condition were removed. The technical
  kill switch, production-dataset guard, product/global pauses, Turnstile,
  server pricing, validation, same-origin checks, rate limits and atomic
  idempotent persistence remain intact.
- Actual document version `Concept 0.2 · 28 oktober 2026` is stored on requests;
  missing configuration falls back to that actual displayed draft version.
  No approved legal version is fabricated. Requests use source `web`, references
  beginning `CA-` and contract status `none` until the separate confirmation step.
- Customers need no account or Access login. Checkout is pickup only, with no
  pickup fee or online payment. The button is “Bestelaanvraag versturen”. The
  page explains personal acceptance, roughly two weeks of production and no
  automatic email. The receipt contains the reference and printable/PDF summary.
- TESTVERSIE and fictional warnings are absent from the production request flow.
  Incomplete documents retain explicit draft/TODO labels. Outdated statements
  about local-only storage were corrected without inventing business identities,
  approved contacts, privacy roles or retention periods.
- The existing four-person encrypted admin allowlist, issuer/AUD and signed JWT
  verification remain unchanged. Admin writes retain CSRF, rate-limit,
  optimistic-concurrency, transaction and audit protection. workers.dev and
  preview access remain disabled for both production Workers.

## Verification

All 185 cases passed: 105 unit/integration/security, 48 storefront browser,
8 admin browser, 10 compiled Access-admin browser, 10 compiled checkout browser,
and 4 public-staging browser cases. TypeScript and all five relevant build modes
passed. Production dependency audit found no known vulnerabilities.

The existing compiled public workflow passed on desktop/mobile: creation,
receipt reload, admin confirmation, payment recording, production, collection
and reporting. Unit tests cover concurrent duplicate submissions and atomic
failure handling. The added regression checks draft-version persistence without
legal-approval gates or fictional source classification.

Live public checks passed on desktop and mobile. Two Olive products quote at
1398 cents from the server. The deployed Siteverify rejects an invalid token
with 403, a forged price returns 409, and cross-origin requests return 403.
Unauthenticated admin requests redirect to the existing Access login. The
rejected security probes created no orders. Staging versions/bindings and
domain mappings were compared with the saved pre-activation state and match.

The owner completed the real browser Turnstile submission, generated a PDF and
saw the request in production admin. The controlled owner request was verified
independently in D1: one `web` order, one idempotency mapping, one creation audit,
one Olive at 699 cents and document version `Concept 0.2 · 28 oktober 2026`.
The owner also saved/reloaded a team note and cancelled the controlled request.
Independent D1 verification confirms version 2, status `cancelled`, contract
status `none`, a persisted non-empty team note matching its audit entry, two
`order.update` audits (note and cancellation), and zero financial events. The
single original order and its history remain; nothing was deleted or duplicated.

## Controlled online acceptance check

Use the owner's own genuine contact details for one non-binding request, not a
fabricated customer or an imported staging order. Select one Olive, put
“Controle bestelaanvraag — niet produceren zonder mijn bevestiging” in notes,
complete Turnstile, and submit once. Reload the receipt, note the `CA-` reference
and check its print/PDF action. Keep the receipt capability private.

In production admin, verify `local:false`, `preview:false`, `writesEnabled:true`;
open the same reference, save a team note and reload. If no actual purchase is
wanted, cancel the request under “Meer opties” before any confirmation or
production. Retain the cancellation and audit history. Do not record a payment
that was not actually received. Verify only one order, one request-creation
audit and one idempotency mapping exist for this reference. No successful
synthetic production order or fictitious payment was created by the agent.

## Stop/rollback

To stop incoming requests quickly, use “Alle aanvragen pauzeren” in admin
Producten. This preserves the current application and permits administration
of existing requests. To restore the prior closed public version instead:

```powershell
pnpm.cmd exec wrangler versions deploy 1197bd2c-9d5e-457e-90fa-e9f4cba60693@100 --config wrangler.shop.jsonc --yes --message "Emergency stop: close public requests"
```

If admin also needs rollback, restore its prior read-only version:

```powershell
pnpm.cmd exec wrangler versions deploy cb17e361-adc2-4ec7-ae36-b6f667449b75@100 --config wrangler.admin.production.jsonc --yes --message "Restore read-only production admin"
```

Do not restore the empty database backup over new customer requests. Preserve
all production records, histories and price snapshots. The old closed public
version disables receipt retrieval as well as submissions; pausing through the
current admin is preferable when only intake should stop.

Ignored evidence/backups: `.wrangler/production-activation-2026-10-28/`, including
`before.sql`, `bookmark-before.json`, exact configuration snapshots, candidate
checks, deployment logs, isolation proof and live screenshots. No rollback was
performed. No Git commit or push was performed during activation.

## Separate business follow-up

Seller identity/status/addresses, applicable fiscal details, public contact,
privacy responsibility/retention, final customer documents, monitoring duties
and the manual confirmation/record-retention process still need finalization.
They remain clearly unapproved where missing; technical activation does not
approve them and no automatic emails have been implemented or promised.
