# Production cutover — 25 October 2026

This records the initial closed production cutover. The later owner-authorized
[order-request activation](order-request-activation.md) supersedes its disabled
flags and active version IDs; staging and the database remain separate.

Completed with explicit owner approval. Customer ordering remains disabled.

| Domain | Worker | Active version |
| --- | --- | --- |
| casa-apero.com | casa-apero | `1197bd2c-9d5e-457e-90fa-e9f4cba60693` |
| admin.casa-apero.com | casa-apero-admin | `cb17e361-adc2-4ec7-ae36-b6f667449b75` |

Both Workers bind exclusively to EU `casa-apero-prod`, UUID
`5d4d738b-4d84-4826-a15d-4652e7e191bd`. The four approved products retain prices
699, 699, 1299 and 2599 euro cents. Final remote checks after owner login show
zero orders, payments, financial events/refunds, market sales and audit entries.
No fictional staging data was imported or changed.

## Preserved restrictions and verification

- `PUBLIC_ORDERS_ENABLED=false`, `LAUNCH_APPROVED=false`, no approved legal
  version, and database `orders_paused=true`.
- Live desktop/mobile checks: TESTVERSIE visible, correct product prices,
  no tester links, no active checkout form and no horizontal overflow on the
  checked pages. Submission APIs return HTTP 403; removed trial routes cannot
  create orders. Existing path-scoped Access policies were not removed.
- Production admin is read-only (`ADMIN_WRITES_ENABLED=false`). The original
  issuer and admin AUD are unchanged; all four approved identities are supplied
  through encrypted `ADMIN_EMAIL_ALLOWLIST` configuration.
- Owner verified actual Access email-OTP browser login, empty order overview,
  four products and disabled editing. The exact `/api/admin/session` response
  confirmed the authorized identity, `local:false`, `preview:false`,
  `writesEnabled:false`. The route has no trailing slash.
- Unauthenticated admin and session requests redirect to the existing Access
  login. Both production Workers have workers.dev and version previews disabled;
  tested alternate URLs were inaccessible. JWT/hostname/CSRF checks remain intact.
- Turnstile secret was uploaded encrypted with the production code. A Siteverify
  preflight rejected an invalid challenge without rejecting the secret. The
  temporary plaintext secret file was overwritten, flushed and deleted after
  deployment/binding verification. No secret value was printed or committed.
- Both original staging Worker versions/bindings and staging D1 were preserved.
  No Access policy, identity provider or subscription was changed.

The new Workers were first deployed without routes. Cloudflare rejected a plain
attach request for the already-owned public hostname without changing it. The
successful cutover used Wrangler's in-place `domains/records` mechanism with
`override_existing_origin=true` and `override_existing_dns_record=false`.
Neither hostname was deleted; original domain/certificate IDs were retained.
Public switched first, closing the fictional checkout before admin switched.

Backups, exact before/after metadata, private upload configs, screenshots and
verification evidence are in ignored `.wrangler/production-cutover/`.
Prepared database exports remain in `.wrangler/production-setup-2026-10-25/`.

## Exact routing rollback

No database restore is necessary. Preserve production data and its ordering
pause. Restore the admin mapping first, then public, using the Cloudflare MCP
`execute` tool with account ID `3de40ffeaeffb3488aa83095a9ec55fe` and this code
(also saved as `.wrangler/production-cutover/rollback.mcp.js`):

```javascript
async () => {
  const base = '/accounts/' + accountId + '/workers/scripts';
  for (const [worker, hostname] of [
    ['casa-apero-admin-staging', 'admin.casa-apero.com'],
    ['casa-apero-staging', 'casa-apero.com']
  ]) {
    await cloudflare.request({
      method: 'PUT',
      path: base + '/' + worker + '/domains/records',
      body: {
        override_scope: true,
        override_existing_origin: true,
        override_existing_dns_record: false,
        origins: [{
          hostname,
          zone_id: 'c6513e3dcdee3225b30ab7f3df2b39ee',
          enabled: true,
          previews_enabled: false
        }]
      }
    });
  }
  return cloudflare.request({
    method: 'GET', path: '/accounts/' + accountId + '/workers/domains'
  });
}
```

Verify the unchanged staging versions after rollback:

- Public: `62185663-a876-4df3-86e6-dcf9116387c1`.
- Admin: `9455748e-5def-4b67-8d7e-da77fbe5116b`.

This restores the previously approved, Access-restricted fictional trial, not
real customer ordering. If that trial should also remain closed, explicitly
disable it before restoring the public mapping. No rollback was executed.

## Before real ordering

School/Vlajo sales-channel permission and approved seller/legal/confirmation
details remain separate business approvals. Do not enable customer-order flags,
approve a legal version or resume the database ordering pause without explicit
launch approval. Admin writes also remain disabled until separately approved.
If Vlajo Market is mandatory, use the approved Market URL and leave the site's
order-creation APIs disabled.
