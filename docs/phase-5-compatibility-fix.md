# Phase 5 — legacy arrangement compatibility

25 October 2026. Local work on develop only. No deployment, remote database
request/mutation, production D1 access, Access change, commit or push is included.
Local tests use fictional records and local/in-memory D1 only.

## Cause

`updateOrder` applied the current ten-character arrangement rule to every update
whose resulting state was neither new nor cancelled. It also normalized the
stored text through `adminText` even when no arrangement change was requested.
An already completed historical order with the valid-for-its-old-release text
`test` therefore rejected a notes-only edit with HTTP 400. Revalidating the entire
stored record made unrelated edits depend on new input rules.

## Change

The server now distinguishes an omitted field, an exactly echoed historical
value, and an explicitly changed value:

- Omitted or identical arrangement text is preserved verbatim. It is not padded,
  trimmed, rewritten or retroactively rejected on unrelated edits or permitted
  production steps. Completed/cancelled records remain readable and editable
  within the existing state-transition rules.
- Every explicitly changed arrangement is validated as text, maximum 1000
  characters, no disallowed control characters, and at least ten characters after
  trimming. This applies to draft and cancelled orders as well. Explicit null is
  an invalid edit, not a request to reuse the old value.
- A new request becoming confirmed always runs full arrangement validation,
  including when a legacy draft's value is omitted or echoed unchanged. Existing
  cost, evidence and confirmation-time checks still apply. Grandfathering an old
  record does not permit a new incomplete confirmation.

The mutation SQL/transaction, authoritative totals, item/price snapshots, payment
logic, history insertion, audit insertion, authorization, CSRF checks, write flag,
rate limit and optimistic version checks are unchanged. No migration or historical
data repair is required. An intentional successful edit still increments its
order version and appends its audit event; unchanged protected data is preserved.

## Changed files

- `worker/admin/api.ts`: narrow change-detection and validation fix.
- `tests/unit/adminApi.test.ts`: historical lifecycle/data-preservation regression
  cases using real local D1 transactions.
- `tests/unit/adminPreview.test.ts`: signed-JWT/write-flag/origin/version checks
  on the completed legacy-record path.
- This report.

## Regression coverage

Fourteen additional cases cover:

- Completed/cancelled short, empty and whitespace-bearing legacy arrangements;
  both omitted and explicitly echoed values on notes-only updates.
- Read-only fetches changing nothing, unrelated records remaining identical,
  old audit entries and all item/payment/history/financial rows staying intact.
- Rejected short, blank, whitespace-only, null, non-string, oversized and
  control-character edits; valid explicit changes on new/completed/cancelled
  records; no silent normalization of historical text.
- New confirmations rejecting incomplete, oversized or unsafe historical values
  even when omitted/echoed; complete confirmations still succeeding.
- Permitted production progression, authenticated origin checks, simultaneous
  edits allowing exactly one success, stale-version rejection, and full rollback
  when audit insertion fails.
- Verified Access JWT, exact email authorization, same-origin policy, the server
  write flag and optimistic concurrency on a completed legacy record.

An initial test fixture incorrectly classified an unchanged empty draft as an
invalid edit. The fixture was corrected to start with different historical text;
the intended unchanged-value behavior was retained. Final results follow below.

## Validation and readiness

All final checks passed:

| Check | Result |
| --- | --- |
| Unit/integration/security (`pnpm test`) | 77 passed, including 14 added regression cases |
| Storefront browsers (`pnpm test:e2e`) | 48 passed |
| Admin browsers (`pnpm test:admin`) | 8 passed |
| Public staging browsers (`pnpm test:staging`, local target) | 4 passed |
| Admin preview browsers (`pnpm test:admin-preview`, local target) | 10 passed |
| TypeScript (`pnpm typecheck`) | Passed |
| Builds (`build`, `build:admin`, `build:staging`, `build:admin-preview`) | All passed, including catalogue snapshot checks |
| Compiled preview verification (`pnpm verify:admin-preview:local`) | Passed |
| Dependency audit (`pnpm audit`) | No known vulnerabilities |
| Whitespace check (`git diff --check`) | Passed |

Total: 147 tests passed; no failures remain. Existing tests were retained.

An additional offline rehearsal used the previously saved fictional staging copy
of `TEST-STUDENT-FLOW-001` with the newly compiled Worker and a locally signed JWT.
Its notes-only save returned 200, preserved the four-character arrangement and
all item/payment/financial/history rows, retained old audit entries and appended
one audit entry. An invalid arrangement edit returned 400 and a stale-version
retry returned 409. This rehearsal made no remote requests or staging mutations;
it is not a new online authentication test.

The compatibility fix is ready for a reviewed commit; no commit has been made.
This resolves the legacy-order compatibility blocker, not the other Phase 5 launch approvals.
Commit readiness does not grant deployment or real-ordering permission. Before
any separately approved staging deployment, refresh the candidate artifact hashes
and repeat the deployment preflight; the earlier read-only review describes the
old failing candidate and remains a historical record.
