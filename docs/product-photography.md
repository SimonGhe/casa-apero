# Official product photography — 30 October 2026

Prepared locally on `develop`. No deployment, commit, push or remote database access.
Original WhatsApp files are preserved in `assets/`. Web copies live in
`public/assets/products/`; source mapping and extraction coordinates are in
`assets/products/photo-manifest.json`.

## Assignment

All filenames below start with `WhatsApp Image 2026-10-29 at ` and end in `.jpeg`.
The first image in each gallery is the main catalogue/cart photo.

| Product | Original filename times, in gallery order | Web filenames |
| --- | --- | --- |
| Aperitivo | `17.08.58 (2)`, `17.08.58`, `17.08.58 (1)`, `17.08.58 (3)`, `17.08.59` | `aperitivo-01.webp` through `aperitivo-05.webp` |
| Dune Grand | `17.10.51`, `17.10.51 (1)`, `17.10.50` | `dune-grand-01.webp` through `dune-grand-03.webp` |
| Dune Mini | `17.11.08` (smaller bowl extraction), `17.11.08 (1)`, `17.11.08 (2)`, `17.11.08` (full frame) | `dune-mini-01.webp` through `dune-mini-04.webp` |
| Olive | `17.11.24` (upper/smaller bowl extraction), `17.11.24 (2)`, `17.11.24 (1)`, `17.11.24` (full frame) | `olive-01.webp` through `olive-04.webp` |
| Olive Grande draft | `17.11.24` (lower/larger bowl extraction) | `olive-grande-01.webp` |

The timestamp groups visually match the supplied mapping: divided aperitif plates,
larger beige bowls, smaller beige bowls and green bowls. Paired green photos are
retained as context; they are not presented as multiple included items. Grande's
size identification is provisional, based on the larger bowl in the image, not
confirmed physical measurements.

## Assets and presentation

- WebP quality 82; 960px-wide gallery images and 480px responsive alternatives.
- EXIF orientation applied; metadata stripped. No generated artwork or retouching.
- Contain images within the existing frames so full gallery photographs remain visible.
- Gallery thumbnails request the small variant. Dutch alt text describes the image.
- Existing four product prices, descriptions, availability and lead times are unchanged.
- Removed obsolete product-photo-coming-soon copy. The homepage's separate original atmosphere image remains honestly labelled.
- Image-only migration `0006_product_photography.sql` updates `images_json` and increments product versions, preserving optimistic concurrency. It does not update prices, product copy, stock/availability, orders, payments or audit history.
- The migration was applied only to local D1. The generated static snapshot agrees with fresh migrated local data; snapshots never write authoritative prices back to D1.

## Olive Grande is not for sale yet

`product-drafts/olive-grande.json` contains a fifth-product preparation record and
photo with `priceCents: null`, `published: false`, and `ordersPaused: true`.
It is deliberately outside the public catalogue and D1 product table: the current
schema requires an integer price, and entering zero would invent a selling price.
No orderable variant was created. Confirm its price, description, dimensions and
photo/size identification before publication.

## Reproduction and later deployment

`node scripts/prepare-product-photos.mjs` regenerates the optimized files and the
image-only migration using the toolchain's installed Sharp. It does not connect to
D1. `node scripts/catalogue-snapshot.mjs --seed` regenerates a baseline snapshot
from an in-memory migrated database; review its diff before use, because current
administrator-edited metadata may differ from the baseline.

Any later deployment needs separate approval for the assets and migration 0006 on
the intended database. Deploying assets alone will not change a D1-backed live
catalogue. Back up current image metadata first; a rollback restores that metadata
and the previous frontend assets without rewriting prices or order history.

## Validation results

- 116 unit/security/integration tests passed, including three new photography checks.
- 50 desktop/mobile storefront browser tests passed, including new gallery coverage.
- 4 compiled production checkout/admin workflow and availability tests passed locally.
- 4 static staging browser tests passed.
- TypeScript and production storefront, production admin and staging builds passed.
- All 34 WebP files were verified in the production storefront build.
- Snapshot comparison against HEAD confirmed only image metadata changed: prices,
  descriptions, availability, production times and shop settings are identical.
- Original inputs total 5.84 MB. Full-size WebP outputs including the extra cropped
  views/draft total 2.51 MB; responsive small copies total 0.60 MB.
- Ten compiled desktop/mobile screenshots were captured with every image decoded
  and no horizontal overflow, using only fictional local workerd data.
- The first highly concurrent browser run had three mobile checkout timeouts while
  builds ran; the full rerun with two workers passed all 50 without application changes.

Ignored local review artifacts: `.wrangler/photo-review/gallery.html` (every mapped
photo), `collectie-desktop.png`, `collectie-mobile.png`, and the
`product-<slug>-desktop.png` / `product-<slug>-mobile.png` screenshots in that folder.
