import type { jwtVerify } from 'jose';
import {verifyAccessIdentity} from '../access-jwt';
import { ApiError } from '../validation';

export interface AdminAuthEnv {
 APP_ENV?: string; ADMIN_AUTH_MODE?: string; ACCESS_ISSUER?: string; ACCESS_AUDIENCE?: string;
 ADMIN_EMAIL_ALLOWLIST?: string;
}
export type AdminIdentity = { id: string; email: string; local: boolean };
export function sameOrigin(request: Request) {
 if(request.headers.get('Origin')!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site') throw new ApiError(403,'origin_rejected','Ongeldige herkomst.');
}
export async function authorizeAccess(request: Request,env:AdminAuthEnv,resolver?:Parameters<typeof jwtVerify>[1]):Promise<AdminIdentity>{
 const url=new URL(request.url);
 if(!['admin','admin-preview'].includes(env.APP_ENV??'')||env.ADMIN_AUTH_MODE!=='access'||url.origin!=='https://admin.casa-apero.com') throw new ApiError(403,'admin_denied','Beheer is hier niet beschikbaar.');
 if(!env.ACCESS_ISSUER||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER)||!env.ACCESS_AUDIENCE||!env.ADMIN_EMAIL_ALLOWLIST) throw new ApiError(403,'admin_unconfigured','Beheer is nog niet geconfigureerd.');
 const token=request.headers.get('Cf-Access-Jwt-Assertion');
 if(!token||token.length>16384)throw new ApiError(401,'login_required','Aanmelden via Cloudflare Access is vereist.');
 try{
  return await verifyAccessIdentity(token,env.ACCESS_ISSUER,env.ACCESS_AUDIENCE,env.ADMIN_EMAIL_ALLOWLIST,resolver);
 }catch{throw new ApiError(403,'admin_denied','Geen geldige beheerdersmachtiging.');}
}
