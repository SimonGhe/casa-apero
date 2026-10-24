import { ApiError } from './validation';

export type TurnstileEnv = {
  APP_ENV: string; TURNSTILE_MODE: string; TURNSTILE_SECRET_KEY?: string; TURNSTILE_SITE_KEY?: string;
};
export const isLoopback = (hostname: string) => ['127.0.0.1', 'localhost', '[::1]'].includes(hostname);

export async function verifyTurnstile(token: string, env: TurnstileEnv, hostname: string, transport: typeof fetch = fetch): Promise<void> {
  if (env.APP_ENV === 'local' && isLoopback(hostname) && env.TURNSTILE_MODE === 'local-mock') {
    if (token === 'local-test-token') return;
    throw new ApiError(403, 'challenge_failed', 'De lokale beveiligingstest is mislukt.');
  }
  const dummyVerification = env.TURNSTILE_MODE === 'siteverify-test' && env.APP_ENV === 'local' && isLoopback(hostname)
    && env.TURNSTILE_SECRET_KEY === '1x0000000000000000000000000000000AA';
  if ((!dummyVerification && env.TURNSTILE_MODE !== 'siteverify') || !env.TURNSTILE_SECRET_KEY || !token || token.length > 2048) throw new ApiError(403, 'challenge_failed', 'Beveiligingscontrole ontbreekt.');
  let result: { success?: boolean; hostname?: string; action?: string };
  try {
    const response = await transport('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('siteverify');
    result = await response.json();
  } catch { throw new ApiError(503, 'challenge_unavailable', 'Beveiligingscontrole tijdelijk niet beschikbaar. Probeer opnieuw.'); }
  // Cloudflare's public dummy service returns synthetic metadata (observed:
  // example.com and no action). Only this explicit loopback/test-key mode may
  // accept that. Real Siteverify always requires exact hostname and action.
  if (!result.success || (!dummyVerification && (result.hostname !== hostname || result.action !== 'order-request'))) throw new ApiError(403, 'challenge_failed', 'Beveiligingscontrole mislukt of verlopen. Probeer opnieuw.');
}
