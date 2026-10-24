# Casa Apero

Local Phase 1 storefront for the existing Casa Apero repository. React, Vite,
TypeScript and Tailwind CSS. Work stays on `develop`. The original GitHub Pages
website remains on `main`.

## Run locally

Requires Node.js 22.12+ (Node 24 LTS recommended) and pnpm.

```sh
git switch develop
pnpm install --frozen-lockfile
pnpm dev
```

Open the Local URL printed by Vite, normally `http://127.0.0.1:5173`.
If the port is occupied, use `pnpm dev --port 5174` instead.
This React app needs the local server; opening index.html directly no longer works.

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser suite uses its own local Vite server if one is not already running.
The compiled website is in `dist/`. `pnpm preview` serves that build locally.

## What works in Phase 1

- Responsive Dutch homepage, catalogue, product details and story pages.
- Catalogue product-type filters, full-description search, sort and empty results.
- Four confirmed products with official descriptions and integer-cent prices.
- Multiple-image galleries and quantity controls; no invented customer variants.
- Shopping cart with browser-local persistence, quantity changes and removal.
- Global and per-product ordering pauses in the local configuration.
- Direct `/bestellen` route with clear payment and arrangement information.
- Official logo in header, homepage brand area and footer, plus a derived favicon.
- Contact/social links, confirmed pickup area and privacy information awaiting school review.

The confirmed catalogue in `src/data/catalogue.ts` is Olive (EUR 6.99), Dune Mini
(EUR 6.99), Dune Grand (EUR 12.99) and Aperitivo (EUR 25.99). Each product has one
internal standard SKU for cart identity; it does not imply an extra product variant.
All four products are available to select, with an estimated production time of
approximately two weeks. A requested date still needs separate confirmation.

Product images remain explicitly labelled temporary crops of the original atmosphere
image, not photographs of these products. Replace entries in each product's `images`
array with supplied photos and set `isPlaceholder: false`; omit `crop` for real photos.
The original logo is retained unchanged in `assets/logo-casa-apero.jpg`; its identical
served copy is `public/assets/logo-casa-apero.jpg`. `public/favicon.png` is a proportional
64px resize of the entire supplied image, with no redraw, recolouring or distortion.

Official about text, Instagram/TikTok links and pickup/delivery/payment copy live in
`src/data/business.ts`. Pickup is by arrangement around Julius en Maurits Sabbestraat,
Brugge. Local delivery and its possible fees must be agreed separately; there is no
shipping-price calculation or free-delivery assumption.

The ordering page is a Phase 1 handoff, not a working checkout. It collects no
customer information and does not submit orders. No fake order confirmation or
reference is generated. The cart contains only product IDs, variant IDs and
quantities; prices are resolved from the official catalogue data for this preview.
The server must recalculate prices from D1 when Phase 2 is implemented.
Old fictional product IDs are deliberately discarded when restoring a cart; they
are never silently mapped to real products. New catalogue selections retain normal
reload/navigation persistence.

## Public contact email

The new brief does not include the actual address, and it flags that a student's
personal address needs publication approval. No personal email is stored or displayed.
Copy `.env.example` to your ignored local `.env.local` and configure an approved public
mailbox only after the team/school has authorized publication:

```dotenv
CASA_PUBLIC_CONTACT_EMAIL=
CASA_PUBLIC_CONTACT_EMAIL_APPROVED=false
```

Set the approval flag to `true` only after that approval, then restart Vite/rebuild.
`vite.config.ts` passes a validated email to the browser only when that flag is true.
An unapproved address is excluded from the generated public configuration, rather than
just hidden in the interface. Never place an unapproved or private address in a
`VITE_*` variable, source file or Git commit.

## Project structure

```text
src/
  components/     Shared layout, product images/cards, quantity input
  context/        Cart state and local storage handling
  data/           Official product catalogue and public business content
  lib/            Pure cart normalization and totals for preview
  pages/          Storefront routes
tests/
  unit/           Cart correctness, damaged/tampered storage, ordering pauses
  browser/        Desktop/mobile journeys, responsive layout, image loading
docs/
  implementation-plan.md
```

Styling now uses approximate colours sampled from the supplied logo: ivory, beige,
earthy brown, olive and subtle terracotta. The legacy `--wine` name is an alias for
the brand brown to preserve existing component styles. The official image is always
used unchanged for the logo, with a readable text wordmark alongside it.
Tailwind's official Vite plugin handles utilities;
`styles.css` contains shared brand and component rules. Icons use lucide-react.
No external fonts, image hosts, trackers or customer-facing analytics are loaded.
Social media links use normal links that open in a new tab, without embedded feeds.

## GitHub Pages and future Cloudflare hosting

Do not push, merge or deploy without the owner's approval. No GitHub workflow,
Pages configuration, Cloudflare account, DNS or production credentials are changed
by this phase. `main` still serves the original website. `develop` is local work.

The target is Cloudflare Workers with Static Assets plus Worker APIs, D1,
Turnstile and Cloudflare Access. Deployment configuration belongs in Phase 4,
after local order/admin functionality and security checks. Do not enable a GitHub
deployment trigger for `develop` during this review.

BrowserRouter uses clean URLs. The future Worker must return index.html for
storefront routes while routing `/api/*` to the backend; API misses must return
JSON errors rather than the SPA document. The public hostname and protected
admin hostname must be configured explicitly after domain confirmation.

No credentials belong in `VITE_*` variables: they are public browser values.
Local `.env*`, `.dev.vars*`, `.wrangler/` and all test/build outputs are ignored.

See `docs/implementation-plan.md` for the remaining phases and release gates.

## Legal pages and checkout preparation

Dutch draft terms, privacy, legal notice, withdrawal/returns/complaints and cookie
information are available through the footer. Every legal page is explicitly a
school/Vlajo review draft. Checkout remains inactive, including its unchecked
acknowledgement and disabled order button; no customer data or orders are submitted.
Cart persistence now lasts four hours after the last change; old indefinite cart
storage is discarded. No consent banner is needed for the current scoped storage.

See [legal readiness](docs/legal-readiness.md) for official sources checked on
24 October 2026, unresolved identity/tax/privacy questions, the storage inventory,
durable-medium confirmation without automated email, and Phase 2 release gates.
