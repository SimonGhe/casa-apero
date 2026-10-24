import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ApiError } from '../validation';

export interface AdminAuthEnv {
 APP_ENV?: string; ADMIN_AUTH_MODE?: string; ACCESS_ISSUER?: string; ACCESS_AUDIENCE?: string;
 ADMIN_EMAIL_ALLOWLIST?: string;
}
export type AdminIdentity = { id: string; email: string; local: boolean };
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
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
  let keys=keySets.get(env.ACCESS_ISSUER);
  if(!keys){keys=createRemoteJWKSet(new URL(`${env.ACCESS_ISSUER}/cdn-cgi/access/certs`),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:300000});keySets.set(env.ACCESS_ISSUER,keys);}
  const {payload}=await jwtVerify(token,resolver??keys,{algorithms:['RS256'],issuer:env.ACCESS_ISSUER,audience:env.ACCESS_AUDIENCE,requiredClaims:['sub','exp','iat','email'],clockTolerance:5});
  const email=typeof payload.email==='string'?payload.email.toLowerCase():'';
  const allowed=env.ADMIN_EMAIL_ALLOWLIST.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(payload.type!=='app'||!payload.sub||!allowed.includes(email)||typeof payload.iat!=='number'||payload.iat>Date.now()/1000+5)throw new Error('denied');
  return {id:payload.sub,email,local:false};
 }catch{throw new ApiError(403,'admin_denied','Geen geldige beheerdersmachtiging.');}
}
