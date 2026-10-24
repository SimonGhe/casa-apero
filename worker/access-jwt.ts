import {createRemoteJWKSet,jwtVerify} from 'jose';
const keySets=new Map<string,ReturnType<typeof createRemoteJWKSet>>();
export async function verifyAccessIdentity(token:string,issuer:string,audience:string,allowlist:string,resolver?:Parameters<typeof jwtVerify>[1]){
 let keys=keySets.get(issuer);
 if(!keys){keys=createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:300000});keySets.set(issuer,keys);}
 const {payload}=await jwtVerify(token,resolver??keys,{algorithms:['RS256'],issuer,audience,requiredClaims:['sub','exp','iat','email'],clockTolerance:5});
 const email=typeof payload.email==='string'?payload.email.toLowerCase():'';
 const allowed=allowlist.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(payload.type!=='app'||!payload.sub||!allowed.includes(email)||typeof payload.iat!=='number'||payload.iat>Date.now()/1000+5)throw new Error('Access denied');
 return {id:payload.sub,email,local:false};
}
