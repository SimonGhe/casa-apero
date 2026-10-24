// Selected by Vite for every admin deployment build. No development session
// key, signer, cookie verifier or simulated login is imported into this module.
import { ApiError } from '../validation';
export { authorizeAccess as authorizeAdmin, sameOrigin } from './access';
export type { AdminAuthEnv, AdminIdentity } from './access';
export const localAdmin = () => false;
export async function localLogin():Promise<Response>{throw new ApiError(403,'admin_denied','Lokale testsessies zijn online uitgeschakeld.');}
export function logoutAdmin():Response{throw new ApiError(403,'admin_denied','Meld af via Cloudflare Access.');}
