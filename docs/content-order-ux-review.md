# Content and order UX review — 29 October 2026

Local changes on `develop`. Not committed, pushed or deployed. No remote database,
Worker configuration, Access policy or live ordering setting was changed.

## Changes ready for review

| Area | Before | After |
| --- | --- | --- |
| Fulfilment | Some pages offered delivery while checkout supported pickup | Pickup by arrangement only; no pickup fee; payment at collection, no online payment |
| Availability | Build-mode copy could disagree with actual ordering availability | Production banner and checkout use backend configuration and catalogue pause state; distinct checking, active, paused and unavailable messages; test builds retain fictional-order warnings |
| Contact | Public email placeholders | `info@casa-apero.com`, confirmed by the owner as approved and tested for receiving and replying |
| Confirmation | Some text implied automatic acceptance or described production confirmation as fictional | Bestelaanvraag first; team reviews, communicates personal confirmation and records evidence before confirming; no automatic email claimed |
| Terms | Inconsistent pickup, payment and production wording | Shared pickup/payment policy; approximately two weeks after personal confirmation; legal documents remain drafts |

New web pickup requests show zero pickup fees. Historical delivery arrangements and
nonzero historical amounts remain readable and are not rewritten. Historical order
prices, confirmation records and legal-version snapshots remain unchanged.

## Validation

- Unit: 113 passed.
- Storefront browser: 48 passed.
- Local admin browser: 8 passed.
- Compiled Access admin-preview browser: 10 passed.
- Compiled checkout browser: 12 passed.
- Static staging browser: 4 passed.
- Total: 195 tests passed. The final production checkout subset was rerun after the last copy changes: 4 passed.
- TypeScript and builds passed for shop, production admin, test checkout, admin preview and staging. Both production builds were repeated after the final source changes.
- Desktop (1440px) and mobile (390px) Playwright captures: 18 checks passed. Additional 320px overflow checks passed.
- Local screenshot gallery: `.wrangler/content-consistency-review/index.html` (ignored by Git).
- `git diff --check` passed. No dependency changes.

A read-only public configuration check showed requests enabled and ordering not
paused. This task did not change that live state. Authentication, backend request
validation, pricing, payments, schema and database writes were not modified.

## Still requires school/owner review

- Legal seller/status, business and pickup/return addresses, fiscal details and final legal-document approval.
- Privacy controller, responsibility/contact and retention rules.
- Approved process for monitoring requests and retaining customer communications, acceptance and durable confirmation.
- Final cancellation/withdrawal wording, return process/cost allocation and any required online withdrawal facility.

The verified mailbox does not imply those decisions are approved. No handmade-product
withdrawal exemption was invented. Documents remain explicitly marked as drafts
(Concept 0.3, 29 October 2026).

Official references used when checking the distinction between a receipt and a
durable confirmation, and the remaining withdrawal review:

- [FOD Economie — Bevestiging van de gesloten overeenkomst](https://economie.fgov.be/nl/themas/verkoop/vormen-van-verkoop/verkoop-op-afstand/bevestiging-van-de-gesloten)
- [FOD Economie — Verkoop op afstand](https://economie.fgov.be/nl/themas/verkoop/vormen-van-verkoop/verkoop-op-afstand/verkoop-op-afstand)
- [ConsumerConnect — Algemene regel voor herroepingsrecht](https://consumerconnect.be/nl/themas/aankoop-product-of-dienst/herroepingsrecht/aankoop-op-afstand/algemene-regel)
