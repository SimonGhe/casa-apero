import { expect, it } from 'vitest';
import staging from '../../worker/staging';

it('rejects every staging API regardless of method, environment flags or missing configuration', async () => {
  for (const path of ['/api', '/api/config', '/api/requests', '/api/orders', '/api/quote', '/api/products', '/api/receipt', '/api/admin', '/api/demo']) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
      const response = await staging.fetch(new Request(`https://preview.workers.dev${path}`, { method }), { APP_ENV: 'local', CHECKOUT_ENABLED: 'true' } as never);
      expect(response.status).toBe(403);
      expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
      expect(await response.json()).toMatchObject({ error: { code: 'staging_disabled' } });
    }
  }
});
it('blocks developer, local checkout, source map and admin paths', async () => {
  for (const path of ['/__debug', '/cdn-cgi/local/explorer/api', '/src/main.tsx', '/node_modules/vite', '/bestellen/lokaal', '/bestellen/ontvangen', '/admin', '/assets/test.js.map']) {
    expect((await staging.fetch(new Request(`https://preview.workers.dev${path}`), {} as never)).status).toBe(404);
  }
});
it('serves robots and applies noindex to frontend and asset responses', async () => {
  const robots = await staging.fetch(new Request('https://preview.workers.dev/robots.txt'), {} as never);
  expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');
  const response = await staging.fetch(new Request('https://preview.workers.dev/collectie'), { ASSETS: { fetch: async () => new Response('storefront') } } as never);
  expect(await response.text()).toBe('storefront');
  expect(response.headers.get('X-Robots-Tag')).toContain('noindex');
});
