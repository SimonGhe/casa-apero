# Phase 5 — launch readiness, local implementation

Review date: 24 October 2026. Work is on develop. **Real ordering stays disabled.**
No deployment, push, remote migration, production D1 access or Cloudflare/Access
configuration change is part of this phase. Existing online staging is unchanged.
Use fictional records only. The approvals below have not been inferred from the
earlier approval to deploy a fictional admin preview.

## Journey audit and improvements

| Stage | Finding | Local result / remaining decision |
|---|---|---|
| Discovery | Frontend owned a second set of names, descriptions, prices and pauses. D1 had no presentation metadata and descriptions initially empty. | D1 owns product data; migration 0004 adds presentation fields and fills only missing descriptions. It never changes prices or order history. |
| Selection/cart | Admin edits were invisible in cards, detail pages and restored carts. | Local storefront consumes the published D1 projection. Only IDs/quantities are persisted; current prices resolve from that catalogue. Pauses propagate. Unpublished selections require explicit correction. |
| Static previews | Workers without D1 cannot follow admin edits live. | A generated JSON snapshot uses the same D1 projection. Frozen snapshots are publication artifacts, not a second editable catalogue. Review/regenerate before an approved publication. |
| Product terms | The legal draft repeated four prices as handwritten text. | Price/name listing now renders from the same catalogue; all draft notices and seller/privacy safeguards remain. Marketing copy avoids duplicating mutable names. |
| Checkout | Pickup was implicitly selected; unclear reload outcomes could lose the in-memory idempotency key. | Explicit pickup/delivery choice required. Opaque attempt/receipt codes survive reload; an existing receipt is recovered before another submission. No customer form contents enter browser storage. |
| Pricing | Server already repriced and atomically rechecked availability. | Retained. Added a price-change race test, rollback checks and historical snapshot assertions. A price conflict refreshes the quote and clears the acknowledgement so the customer reviews again. |
| Confirmation | Journey text put production before agreed confirmation. Generic receipts could look like current order status. | Text now puts agreement/confirmation first. Receipt explicitly describes original receipt only; it is not production tracking or durable contract confirmation. Quote/receipt lead times use their server snapshots. |
| Production | Safe authenticated workflow exists, but customer acceptance is represented only by a free-text evidence field. | Kept local/fictional. Reject empty/trivial arrangement text. Real release still needs verifiable acceptance and immutable confirmation content. Ten characters cannot prove an arrangement is complete. |
| Payment | Separate cumulative payment/refund ledger and idempotent event summaries already exist. | Retained. Paid cash less refunds is distinct from estimated costs; cancelled cash remains until refunded. School must decide permitted collection-before-payment policy; Afgerond does not mean paid. |
| Collection | Ready/completed statuses exist, without an automatic customer message or detailed handover receipt. | Manual approved-mailbox communication and collection procedure need owner approval. No automatic mail/payment integration added. |

## One authoritative catalogue

Authoritative editable business values live in **D1 products/settings**. The
published projection in `worker/catalogue.ts` explicitly selects only product
information; it does not read customers, notes, financial costs, audit identities
or tokens. `shared/catalogue.ts` validates its shape and rejects unexpected fields
and external image URLs. All four existing SKUs and their initial prices are
preserved: Olive 699, Dune Mini 699, Dune Grand 1299, Aperitivo 2599 euro cents.

Migration `0004_catalogue_presentation.sql` adds slug, category, type label,
image metadata and display order. It preserves existing edited descriptions and
prices, and does not update order items. Media currently remains the explicitly
labelled placeholder imagery. New products/media require a reviewed content change;
the catalogue is deliberately limited to the four confirmed SKUs.

`CatalogueProvider` reads `/api/catalogue` only in loopback Vite development.
Product pages, cards, home, cart and draft terms use that provider. It refreshes
on returning focus and fails closed on fetch/schema errors: it does not silently
offer a stale fallback price. The request quote and atomic insert remain the
authority, including races after the page/quote was loaded.

The new endpoint is inside the existing APP_ENV=local + loopback + DB guard.
It is **not enabled on public/deployed hosts**. Staging still rejects every API;
admin preview still rejects public API paths. Production checkout remains guarded.
No change to a frontend flag can enable the server purchase flow.

Static builds use `src/data/catalogue.snapshot.json`, generated by the same
projection from local D1. Do not hand-edit it. Commands:

```powershell
pnpm.cmd db:migrate           # hard-coded local D1 configuration
pnpm.cmd catalogue:check      # schema/safety check of generated JSON
pnpm.cmd catalogue:diff       # read local D1; report drift without writing files
pnpm.cmd catalogue:snapshot   # generate product-only JSON from local D1
git diff                     # review before any separately approved publication
```

The script cannot select remote D1, exports no customer/private columns, and does
not deploy. `--seed` is a bootstrap utility that builds a snapshot in memory from
fresh migrations; do not use it to replace reviewed administrator edits. Historical
migrations are initialization history, not a second runtime product service.

**Limit:** this does not make the deployed public site follow the separately
deployed admin staging database. Nothing online was changed. Eventual live dynamic
catalogue access requires an explicitly approved public product-only read path,
the correct database binding, cache/refresh policy and tests with orders still off.
Alternatively approve a frozen-catalogue publication policy and regenerate it on
every commercial edit. Do not promise live sync from a frozen artifact.

## Simplest confirmation proposal — approval required

Recommend initially accepting **non-binding requests**, with manual handling at
the expected student-project volume. Use an existing school-approved business
mailbox; there is no reason to buy an email platform for this workflow now.

1. A request receipt states that no agreement, production or payment starts.
2. A responsible team member checks capacity, costs and complete pickup/delivery
   details, then sends the complete offer and versioned terms to the customer.
3. Record the customer's explicit acceptance and the agreed contract moment.
4. Send the complete confirmation as email text and/or a fixed PDF attachment.
   Archive the exact content/version privately with recipient, date, responsible
   administrator and evidence of transmission. Handle failed delivery before
   production/collection according to the approved process.
5. Start production only after these steps have been verified. Record money only
   when actually received; arrange collection through the approved channel.

This separates an electronic receipt from contract confirmation on a durable
medium. A mutable page/link, a PDF download button or the admin's free-text field
alone is insufficient evidence that the complete confirmation was supplied.
[FOD Economie explains the separate confirmation steps](https://economie.fgov.be/nl/themas/ondernemingen/guidance/handelspraktijken/informatieverplichting-bij-e/veelgestelde-vragen-over-de).

The server currently stores product/price snapshots, costs, arrangement text and
confirmation evidence/time, **not** a complete immutable legal document plus
separate customer-acceptance proof. Building protected confirmation snapshots,
downloads and acceptance/delivery events is a remaining release task after the
seller identity, terms and contract process are approved. Documents must remain
private; never publish customer PDFs at predictable/static asset URLs.

Online withdrawal is a separate release blocker: the current draft page is not
a working withdrawal submission/acknowledgement flow. Belgian official guidance
now describes the online withdrawal function and a confirmation of submission.
Do not assume a lightly monitored manual mailbox satisfies the acknowledgement
timing. Agree and test that process before launch; do not purchase a provider
until the approved existing school's capabilities are known.
[Current FOD withdrawal guidance](https://news.economie.fgov.be/270128-een-impulsieve-online-aankoop-er-is-een-weg-terug/).

## Privacy and security review

- Local catalogue SQL and snapshot export include only published product columns.
  Private admin APIs retain verified Access JWT/hostname/allowlist checks.
  Customer records cannot be retrieved by public order reference.
- Receipts require an unguessable capability, omit customer contact data and use
  no-store responses. The browser stores cart identifiers/expiry and opaque local
  receipt/attempt codes, not customer form fields. Same-key retries survive reload.
  The local storage explanation was updated accordingly. Simultaneous receipt and
  catalogue reads are coalesced only while in flight, not cached after completion;
  a 15-second request timeout preserves the unresolved attempt instead of silently
  starting a new one when the service is slow.
- Prepared statements, validation/body limits, atomic snapshot creation,
  ordering pauses, idempotency, CSRF protections and rate limits remain in place.
  No secrets, logs containing customer data, public admin routes, analytics,
  mail transport, paid dependency or production credentials were added.
- Test results prove local origin denial and projection shape, not a new live
  Access configuration audit. Online Access was verified in Phase 4B; this phase
  does not contact or alter Cloudflare infrastructure.
- Production still needs approved retention/deletion/rights/incident procedures.
  Append-only audit JSON can contain arrangement/note data: decide minimization
  and lawful retention/anonymization design before storing real customers. Do
  not simply disable audit triggers or retain personal data indefinitely.
  [EDPB guidance on minimization, retention and security](https://www.edpb.europa.eu/sme/learn-the-basics/data-protection-basics_en).

## Approval checklist and remaining blockers

Use [the Dutch approval checklist](launch-approval-checklist.md). Every item needs
a named owner, written decision/evidence and review date. Earlier staging
deployment approval does not approve real transactions, student permissions,
tax status or seller identity. No launch date is asserted by this audit.

## Validation and next steps

Run local migrations before development. Browser scripts now do this explicitly
against `wrangler.local.jsonc`. Run storefront and admin browser suites sequentially
because they share the original local development DB. Preview fixtures have their
own in-memory D1 and signed test JWT/JWKS and do not contact the online admin.

```powershell
pnpm.cmd test
pnpm.cmd typecheck
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
pnpm.cmd catalogue:check
pnpm.cmd catalogue:diff
pnpm.cmd audit
```

Final verification results (all local, fictional data):

| Check | Result |
|---|---|
| Unit/integration, actual local Miniflare D1 and migration upgrade checks | 63 passed |
| Complete storefront desktop/mobile browser suite | 48 passed |
| Local admin desktop/mobile browser suite | 8 passed |
| Compiled admin preview desktop/mobile browser suite | 10 passed |
| Compiled public staging desktop/mobile browser suite | 4 passed |
| Total automated cases | **133 passed; zero unresolved failures** |
| TypeScript and storefront/admin/staging/admin-preview builds | Passed |
| Compiled signed-JWT/JWKS and artifact isolation verification | Passed |
| Snapshot schema check and local D1/snapshot drift check | Passed; four confirmed prices unchanged |
| Dependency audit | No known vulnerabilities |
| Whitespace checks and mobile checkout screenshot inspection | Passed |

Existing tests were preserved. Initial diagnostics found a viewport-sweep timeout
at eight workers, a locator that could not address a prefilled wrapped textarea,
and slow duplicate receipt reads in development rendering. Storefront concurrency
is now bounded at four workers, the textarea test uses its accessible role/name,
and in-flight-only request coalescing plus request timeouts address the recovery
path. The complete final storefront run passed without retries. No assertions
about authorization or duplicate creation were weakened.

All four build commands now validate the generated snapshot before compilation.
Main new implementation files are `shared/catalogue.ts`, `worker/catalogue.ts`,
`src/context/CatalogueContext.tsx`, `src/lib/catalogueApi.ts`, the generated
`src/data/catalogue.snapshot.json`, `scripts/catalogue-snapshot.mjs` and migration
0004. Consumer updates cover App/main, product cards/pages, home, cart, layout,
draft terms and local checkout/orderApi. Admin arrangement validation/help and
unit/browser/security tests were updated. README and the earlier legal-readiness
record link to this report and the separate approval checklist.

Known limits: real confirmation delivery/immutable content/acceptance, online
withdrawal, production abuse controls and privacy retention workflows are not
implemented by this local preparation. No real-email delivery, real Access login,
actual Excel session, production migration or live deployment was performed in
this phase. A static preview remains frozen until explicitly regenerated and
published; no live public-D1 synchronization is claimed.

Next deployment must be **separately approved**, limited first to fictional
staging with ordering off. Review snapshot/content and migration 0004; back up
the isolated staging DB before any approved migration. Verify Access, alternate
hosts, product publication, historical prices and all order-denial checks online.
Do not bind public staging to production D1 or copy fictional orders into it.
Only after the school/owner approvals and remaining implementation blockers are
resolved should a distinct production release be proposed for approval.
