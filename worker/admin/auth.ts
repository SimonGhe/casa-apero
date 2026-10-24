import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { ApiError } from '../validation';
import { isLoopback } from '../turnstile';

export interface AdminAuthEnv {
  APP_ENV?: string; ADMIN_AUTH_MODE?: string; ACCESS_ISSUER?: string; ACCESS_AUDIENCE?: string;
  ADMIN_EMAIL_ALLOWLIST?: string;
}
export type AdminIdentity = { id: string; email: string; local: boolean };
const sessionKey = crypto.getRandomValues(new Uint8Array(32));
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export const localAdmin = (request: Request, env: AdminAuthEnv) => env.APP_ENV === 'local-admin' && env.ADMIN_AUTH_MODE === 'local-session' && isLoopback(new URL(request.url).hostname);

export function sameOrigin(request: Request) {
  if (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site') throw new ApiError(403, 'origin_rejected', 'Ongeldige herkomst.');
}
export async function localLogin(request: Request, env: AdminAuthEnv) {
  if (!localAdmin(request, env)) throw new ApiError(403, 'admin_denied', 'Beheer is hier niet beschikbaar.');
  sameOrigin(request);
  const token = await new SignJWT({ email: 'beheerder@example.invalid', type: 'app' }).setProtectedHeader({ alg: 'HS256' })
    .setIssuer('casa-apero-local-admin').setAudience('local-admin').setSubject('fictional-admin')
    .setIssuedAt().setExpirationTime('2h').sign(sessionKey);
  return new Response(null, { status: 204, headers: { 'Set-Cookie': `casa_admin_local=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=7200`, 'Cache-Control': 'no-store' } });
}

// Injectable key resolver is used only by signed-fixture tests, never from a request.
export async function authorizeAdmin(request: Request, env: AdminAuthEnv, resolver?: Parameters<typeof jwtVerify>[1]): Promise<AdminIdentity> {
  const url = new URL(request.url);
  if (localAdmin(request, env)) {
    const token = request.headers.get('Cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('casa_admin_local='))?.slice('casa_admin_local='.length);
    if (!token) throw new ApiError(401, 'login_required', 'Start een lokale testsessie.');
    try {
      const { payload } = await jwtVerify(token, sessionKey, { algorithms: ['HS256'], issuer: 'casa-apero-local-admin', audience: 'local-admin', requiredClaims: ['sub','exp','iat'] });
      return { id: payload.sub!, email: 'beheerder@example.invalid', local: true };
    } catch { throw new ApiError(401, 'invalid_session', 'Je testsessie is verlopen.'); }
  }
  // No alternate hostname, workers.dev URL or staging config may reach JWT checks.
  if (env.APP_ENV !== 'admin' || env.ADMIN_AUTH_MODE !== 'access' || url.hostname !== 'admin.casa-apero.com' || url.protocol !== 'https:') throw new ApiError(403, 'admin_denied', 'Beheer is hier niet beschikbaar.');
  if (!env.ACCESS_ISSUER || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER)
    || !env.ACCESS_AUDIENCE || !env.ADMIN_EMAIL_ALLOWLIST) throw new ApiError(403, 'admin_unconfigured', 'Beheer is nog niet geconfigureerd.');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) throw new ApiError(401, 'login_required', 'Aanmelden via Cloudflare Access is vereist.');
  try {
    let keys = keySets.get(env.ACCESS_ISSUER);
    if (!keys) { keys = createRemoteJWKSet(new URL(`${env.ACCESS_ISSUER}/cdn-cgi/access/certs`), { timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 300000 }); keySets.set(env.ACCESS_ISSUER, keys); }
    const { payload } = await jwtVerify(token, resolver ?? keys, { algorithms: ['RS256'], issuer: env.ACCESS_ISSUER,
      audience: env.ACCESS_AUDIENCE, requiredClaims: ['sub','exp','iat','email'], clockTolerance: 5 });
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    const allowed = env.ADMIN_EMAIL_ALLOWLIST.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
    if (payload.type !== 'app' || !payload.sub || !allowed.includes(email) || typeof payload.iat !== 'number' || payload.iat > Date.now() / 1000 + 5) throw new Error('denied');
    return { id: payload.sub, email, local: false };
  } catch { throw new ApiError(403, 'admin_denied', 'Geen geldige beheerdersmachtiging.'); }
}
