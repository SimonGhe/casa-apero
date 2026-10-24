import { ApiError } from '../validation';
export const ADMIN_WRITE_LIMIT=60;
export async function limitAdminWrites(db:D1Database,subject:string,now=Date.now()){
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(subject))),(byte)=>byte.toString(16).padStart(2,'0')).join('');
 const minute=Math.floor(now/60000),bucket=`admin-write:${hash}:${minute}`;
 const results=await db.batch([
  db.prepare(`INSERT INTO rate_limits(bucket,attempts,expires_at) VALUES (?,1,?)
   ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts`).bind(bucket,(minute+2)*60000),
  db.prepare('DELETE FROM rate_limits WHERE expires_at<?').bind(now),
 ]);
 const attempts=(results[0].results[0] as {attempts?:number}|undefined)?.attempts;
 if(typeof attempts!=='number')throw new ApiError(503,'rate_limit_unavailable','Schrijfcontrole tijdelijk niet beschikbaar.');
 if(attempts>ADMIN_WRITE_LIMIT)throw new ApiError(429,'admin_rate_limited','Te veel beheerwijzigingen. Probeer over een minuut opnieuw.');
}
