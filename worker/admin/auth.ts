import { jwtVerify, SignJWT } from 'jose';
import { ApiError } from '../validation';
import { isLoopback } from '../turnstile';
import { authorizeAccess, sameOrigin } from './access';
import type { AdminAuthEnv, AdminIdentity } from './access';
export type { AdminAuthEnv, AdminIdentity } from './access';
export { sameOrigin } from './access';

const sessionKey = crypto.getRandomValues(new Uint8Array(32));
export function logoutAdmin(){return new Response(null,{status:204,headers:{'Cache-Control':'no-store, private','Set-Cookie':'casa_admin_local=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0'}});}
export const localAdmin = (request: Request, env: AdminAuthEnv) => env.APP_ENV === 'local-admin' && env.ADMIN_AUTH_MODE === 'local-session' && isLoopback(new URL(request.url).hostname);

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
  if (localAdmin(request, env)) {
    const token = request.headers.get('Cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith('casa_admin_local='))?.slice('casa_admin_local='.length);
    if (!token) throw new ApiError(401, 'login_required', 'Start een lokale testsessie.');
    try {
      const { payload } = await jwtVerify(token, sessionKey, { algorithms: ['HS256'], issuer: 'casa-apero-local-admin', audience: 'local-admin', requiredClaims: ['sub','exp','iat'] });
      return { id: payload.sub!, email: 'beheerder@example.invalid', local: true };
    } catch { throw new ApiError(401, 'invalid_session', 'Je testsessie is verlopen.'); }
  }
  return authorizeAccess(request,env,resolver);
}
