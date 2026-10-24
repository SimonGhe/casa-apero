# Phase 4B — fictional admin staging writes

Work remains on develop. The owner explicitly authorized updates only to
`casa-apero-admin-staging` and its fictional EU staging D1. The owner verified
actual Access OTP login and session identity before this phase. No Access policy,
public storefront, production D1, GitHub branch or production deployment changes
are authorized or required.

## Configuration and isolation

`wrangler.admin.preview.jsonc` enables ADMIN_WRITES_ENABLED=true independently
of CHECKOUT_ENABLED=false. Missing settings still deny access or writes.
The only route is admin.casa-apero.com; workers.dev and preview URLs are disabled.
The exact D1 binding is `f8c58abc-95ab-4fd9-8279-5f0f0f2ada83`:
`casa-apero-admin-staging`, jurisdiction eu. Production UUID
`5d4d738b-4d84-4826-a15d-4652e7e191bd` must never appear in that binding.
The Worker checks the fictional dataset marker and every order's fictional
source/email before serving assets or APIs. No new migration is needed.

Access-only code verifies RS256 signatures through issuer JWKS, issuer, AUD,
expiry/not-before/issued-at, application token type and the server email allowlist.
All assets and APIs require authentication at the exact HTTPS origin. Every
mutation also checks the server write flag and exact same-origin Origin, rejects
cross-site requests, validates JSON (maximum 16 KiB) and uses prepared statements.
No permissive CORS headers are supplied. Private responses are no-store with
noindex, framing denial and no-referrer. No JWT or personal data logging was added.
Deployed bundles exclude local simulated authentication. Observability is off.

An atomic D1 counter limits writes to 60 attempts per verified subject per minute.
Subjects are hashed in rate-limit keys; old counters expire. Business mutations
use optimistic versions and atomic update/history/audit/finance batches. Audit
and financial ledgers remain append-only. Payments/refunds use cumulative amounts:
stale retries conflict and unchanged cumulative amounts are rejected. Market-sale
UUID/payload hashes are idempotent, including concurrent requests. An opaque
pending UUID survives browser reloads in sessionStorage; no form or customer data
is stored there. A retry must use the same input, or explicitly start a new sale
after checking existing records. Clearing browser storage loses this recovery ID.

## Reporting

Only recorded payments count as cash receipts; unpaid/cancelled unpaid requests
do not. Refunds subtract from receipts. Money held for a paid cancelled order stays
in cash receipts until refunded; a separate warning displays that outstanding
refund liability across all dates. This prevents cancellation hiding received cash.
Physical sales count once and audited voids reverse them. Product edits preserve
order/financial snapshots. Costs are estimated product costs; missing costs are
unknown, not zero. This is not actual net profit or statutory accounting.
CSV remains authenticated, UTF-8 BOM, semicolon-delimited, with decimal commas,
quoting and spreadsheet formula escaping. The unchanged public storefront does
not read this staging database, so admin product edits affect the preview only.

## Backup and rollback

Before writes, a remote staging export and Time Travel bookmark were saved to
the ignored directory `.wrangler/backups/admin-staging-2026-10-24T16-25-48-768Z`.
`staging-before-writes.sql` is 10084 bytes, SHA256
`39058a4e3341ac000aa3f3b98dc32802fc704f613bb0e495f7bd1b7e1aa995a8`.
It was restored in memory: integrity_check=ok, zero foreign-key violations,
one fictional order and the expected marker. `baseline.json` records pre-change
Worker settings/deployments/domains and database metadata, not production contents.
`time-travel.json` contains the pre-write bookmark. Keep the SQL backup locally.

To disable writes, set only preview ADMIN_WRITES_ENABLED=false, build the preview,
then deploy its generated configuration. Verify the remote flag is false afterward.
Alternatively roll back to the original read-only version:

```powershell
pnpm.cmd exec wrangler rollback fd252238-d4e6-45d2-b38f-ec8803e38f35 --name casa-apero-admin-staging --config wrangler.admin.preview.jsonc
```

Verify the deployed write flag after rollback. Worker rollback does not undo D1
changes. If database recovery is needed, first export current staging data, then
use the saved bookmark ONLY with the staging config/UUID. Time Travel restore
overwrites later staging changes; do not run it casually. Free retention is
[seven days](https://developers.cloudflare.com/d1/reference/time-travel/).
The SQL export remains available beyond that window. Never restore to production.

## Local validation

```powershell
pnpm.cmd typecheck
pnpm.cmd test
pnpm.cmd build
pnpm.cmd build:admin
pnpm.cmd build:staging
pnpm.cmd build:admin-preview
pnpm.cmd verify:admin-preview:local
pnpm.cmd test:e2e
pnpm.cmd test:admin
Remove-Item Env:STAGING_URL -ErrorAction SilentlyContinue
pnpm.cmd test:staging
pnpm.cmd test:admin-preview
pnpm.cmd audit
```

Run browser suites sequentially. Compiled preview fixtures always use local D1
and in-memory signed test JWTs/JWKS; both enabled-write and read-only fixtures run.
They never contact the actual admin hostname. These tests do not prove online OTP.
The new desktop/mobile scenarios verify persisted status edits, unauthorized write
denial and lost-response/reload market-sale deduplication with one audit entry.

## Deployment and verification — 24 October 2026

### Student workflow simplification

Current admin version: `0636bd8f-17ac-40c5-adca-f9ded53a953e`.
The owner approved a simpler student interface after confirming the online state
changes worked. The order view now presents progress and one contextual action:
Bestelling bevestigen → Productie starten → Klaar voor afhaling → Bestelling
afronden. There is no status dropdown. Confirmation opens a short guided form;
required arrangements, explicit costs, durable-confirmation evidence and time
remain mandatory and server-validated. Nothing is sent to the customer.

Team notes and arrangements have a separate plain-language form; typed drafts
are also included with production-step updates and preserved across payment
updates. Payment registration opens only when requested, prefills the agreed
total and asks for a method. Refunds use the amount being returned, converted to
the server's cumulative refunded total. Cancellation requires an explicit second
confirmation. Refunds, cancellation, technical cost/confirmation details and the
order audit are under Meer opties. Overview cards are hidden while an order is
open; desktop/mobile screenshots were inspected and viewport overflow is tested.
Branding and the fictional-test notice remain, with shorter Dutch wording.

Implementation: extracted `src/admin/OrderEditor.tsx` and `AuditRows.tsx`, updated
Dashboard/admin styles and browser scenarios without removing existing test
coverage. Backend authorization, transition rules, pricing and atomic/audit logic
were not relaxed. The local compiled fixture now drains in-flight responses before
disposal; browser pages close first to avoid teardown network races. Test selectors
were updated to the new action-based interface and accessible textbox names.

Final checks: 56 unit/integration tests, 8 local admin browser tests and 10 compiled
preview browser tests passed. TypeScript, preview build, compiled JWT/artifact
verification, dependency audit (no known vulnerabilities) and whitespace checks
passed. Coverage includes notes retained with a step change, required confirmation
fields, future-date rejection, progression persisting after reload, payment/refund
registration, explicit cancellation, read-only mode and unauthorized write denial.
The preceding storefront/public-staging suite results remain unchanged; those
services were not deployed by this follow-up.

Staging history independently confirms the owner's actual online transitions:
new → confirmed at 19:50:01.580Z, confirmed → in_production at 19:54:30.790Z and
in_production → cancelled at 19:54:36.297Z, with recorded audit actors. This
supersedes earlier pending-status-test notes below. The original order remains
cancelled/version 4 with its four original audit entries.

A fresh `TEST-STUDENT-FLOW-001` was seeded only in the isolated staging D1 for
reviewing the new flow. `preview/student-flow-fixture.sql` is repeatable and adds
a clearly marked fixture.seed audit entry. Before seeding, staging was exported
to `before-student-fixture.sql` in the ignored backup directory; restore integrity,
foreign keys, repeatability and preservation of the original order were checked
locally. Post-seed checks show two fictional orders and zero non-fictional records.
No customer order API was enabled and no original record was reset.

Post-deployment checks confirm the original staging D1 UUID, Access mode, writes
enabled, checkout disabled, workers.dev/preview 404 and anonymous/forged writes
intercepted by Access. The verification helper now compares the record before
and after unauthorized probes rather than incorrectly assuming a legitimate user
could never have cancelled it. Those probes caused no record/audit changes.
Public Worker settings/version/domain mappings remain identical to the original
baseline; the public banner remains and order APIs return 403. No production D1,
public Worker, Access policy, GitHub or paid-service changes occurred.
Proof: `student-flow-deployment.log`, `student-flow-postdeploy-check.json` and
`student-fixture-backup-proof.json` in the ignored backup directory. The owner
can review the new UI at the existing admin URL after a hard refresh.

### Valid status choices follow-up

Previous admin-only version: `c1aca6f0-fc91-437e-b3fb-2602de5ffba7`.
The owner supplied the actual error, "Deze statusovergang is niet toegestaan",
while the saved status was Nieuw. This establishes that the attempted transition
was rejected by the workflow rules; it was not an accepted status update lost
on reload. The dropdown previously listed every state, including invalid jumps.

The frontend and backend now share the same transition map. The dropdown offers
the current state plus valid next states only. From Nieuw this means Nieuw,
Bevestigd and Geannuleerd. After saving Bevestigd, In productie becomes available.
The server still validates transitions independently on every request. A short
instruction explains that each production step must be saved before the next.
The confirmation requirements and financial/security guards are unchanged.

Validation: 56 unit/integration tests, 8 compiled preview browser tests and
8 local admin browser tests passed; TypeScript/preview build, compiled auth/
artifact verification and whitespace checks passed. Desktop/mobile assertions
check the exact available options before and after a persisted confirmation.
Live isolation/public-site/Access/alternate-host checks passed after deployment;
proof is in `status-choices-deployment.log` and `status-choices-check.json` in the
ignored backup directory. The fictional record remains new/version 1 until the
owner completes a valid authenticated confirmation. No production/public Worker,
Access policy or database schema changes were made.

### Save-feedback follow-up

Previous admin-only Worker version: `e96a4a56-2d49-4732-869b-5a53e6cdd5f3`.
After the owner reported that notes persisted but other edits did not, the live
record was still new/version 1 with only the verified note and one audit entry.
An incomplete confirmation was reproduced locally as a rejected 400, with no
status/note/audit commit; a complete confirmation returned 200 and persisted.
This reproduces one possible cause, not proof of the owner's exact failed input.

The form now marks arrangements, delivery amount, confirmation evidence and
date/time required when selecting Bevestigd. It displays the saved server status
separately, announces successful saves only after the server response, and focuses
and scrolls rejected-save messages into view. Server validation now identifies
missing delivery cost, evidence or invalid/future confirmation time explicitly.
Confirmation costs/time are still recorded only during the confirmation step;
the form explains this. Authentication and transition requirements are unchanged.

Follow-up checks passed: 56 unit/integration tests, 8 compiled preview browser
tests and 8 local admin browser tests, TypeScript/preview build, compiled
JWT/artifact checks and diff whitespace checks. New desktop/mobile regression
coverage verifies missing-field blocking, focused rejection messages, no commit
on invalid future time and a complete confirmation surviving reload. The earlier
storefront and public staging test results below remain the preceding full run.

After this update, live metadata still confirms the exact isolated staging D1,
Access mode, writes enabled and checkout disabled. Workers.dev/version preview
return 404; anonymous/forged write attempts redirect to Access without changing
the order. Public deployment/settings/domain mappings match the original baseline,
the test banner remains and public ordering APIs return 403. No database migration,
production modification, Access change or public deployment was performed.
`save-feedback-deployment.log` and `save-feedback-check.json` in the ignored backup
directory record this follow-up. Live status-transition verification is pending.

### Initial write-enabling deployment

Deployed only the generated `dist-admin-preview/worker/wrangler.json` after
checking branch, exact binding, route, disabled alternate URLs, server Access
values against the previous deployed configuration and backup existence.

- URL: https://admin.casa-apero.com
- Worker version: `b12b97fa-b4dd-46c3-8ccb-18d6d3958fea`
- Remote metadata confirms the staging UUID above, Access mode,
  ADMIN_WRITES_ENABLED=true and CHECKOUT_ENABLED=false.
- No new Cloudflare resources or migrations were needed. No Access changes.
- Final validation: 55 unit/integration tests; 36 storefront browser tests;
  8 local admin browser tests; 4 local public staging browser tests;
  6 compiled admin preview browser tests. All pass, as do TypeScript, all four
  builds, compiled artifact/JWKS verification, diff whitespace checks and audit
  (no known vulnerabilities). Existing tests remain.
- Initial compiled write browser tests exposed a duplicate Origin header in the
  fixture's header merge. The fixture now merges Headers case-insensitively;
  the unchanged server origin check correctly rejected those test requests.
  All six preview tests passed after this correction.
- Online anonymous root, session, orders and export return Access 302 redirects
  matching the configured issuer/AUD. Anonymous and forged-header PUT attempts
  also redirect; no business changes occurred (order still new/version 0,
  audit count 0 immediately afterward). Edge redirects protect the live route;
  they are not direct evidence of origin 401/403. Local signed workerd fixtures
  independently verify origin rejection of missing/invalid credentials.
- workers.dev and version-preview API URLs return 404; metadata confirms both
  are disabled. The public Worker settings, deployment and custom-domain mappings
  match the pre-change baseline exactly. Public homepage/asset return 200 and
  contain TESTVERSIE / Bestellingen nog niet mogelijk. Public POST requests to
  /api/requests, /api/orders, /api/quote and /api/admin/orders return 403.
- The first Node live HTTP probe hit a transient local resolver ENOTFOUND.
  Windows resolution and curl then succeeded; final sanitized HTTP probes used
  curl with normal hostname/TLS verification, with no authentication bypass.

The owner subsequently reported a note persisted in the actual online admin.
Read-only queries against the exact staging binding independently confirmed
TEST-ADMIN-PREVIEW-001 has internal_notes="Test", version=1 and one order.update
audit entry. The audit timestamp is 2026-10-24T19:35:37.306Z, with a recorded actor,
before notes empty and after notes "Test". The status remained new. This verifies
an authenticated online note write and persistence, not a production-status change.
No code, deployment or authentication relaxation was needed for this successful save.
The earlier reported unsuccessful confirmation has no established failure cause.

The separate live status-transition test remains pending: confirm that fictional
record with test arrangements, zero delivery costs and fictional durable-confirmation
evidence/time; save, reload and reopen, then independently verify D1 status/history
and audit. There is no connected authenticated browser in this session. No
credential is needed in chat. A live unapproved-identity OTP attempt and opening
CSV in actual Excel have not been performed; automated allowlist/CSV tests cover
their backend logic.

Local deployment/HTTP proof files are beside the ignored SQL backup. No Git push
was performed. Production database contents were never read or modified.
