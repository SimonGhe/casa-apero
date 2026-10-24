// Intentionally independent of the local order Worker: no D1, secrets, admin,
// demo endpoints, request parsing or order-processing imports exist here.
interface StagingEnv { ASSETS: Fetcher; APP_ENV?: string; CHECKOUT_ENABLED?: string }
const denyIndexing = (response: Response) => {
  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};
export default {
  async fetch(request: Request, env: StagingEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    let response: Response;
    if (path === '/api' || path.startsWith('/api/')) {
      response = Response.json({ error: { code: 'staging_disabled', message: 'TESTVERSIE — Bestellingen nog niet mogelijk.' } }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    } else if (path === '/robots.txt') {
      response = new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
    } else if (!['GET', 'HEAD'].includes(request.method)) {
      response = new Response('Bestellingen zijn niet mogelijk in deze testversie.', { status: 405, headers: { Allow: 'GET, HEAD' } });
    } else if (/^\/(?:__debug|cdn-cgi\/local|@vite|@id|@fs|src|node_modules|\.wrangler|\.dev\.vars|bestellen\/(?:lokaal|ontvangen)|admin)(?:\/|$)/.test(path) || /\.(?:map|sql)$/.test(path)) {
      response = new Response('Pagina niet beschikbaar.', { status: 404 });
    } else {
      response = await env.ASSETS.fetch(request);
    }
    return denyIndexing(response);
  },
};
