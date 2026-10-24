import { beforeAll, expect, it } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { authorizeAdmin, localLogin } from '../../worker/admin/auth';
import adminWorker from '../../worker/admin';
import publicWorker from '../../worker/index';
import staging from '../../worker/staging';
let privateKey:CryptoKey,publicKey:CryptoKey;
const env={APP_ENV:'admin',ADMIN_AUTH_MODE:'access',ACCESS_ISSUER:'https://test-team.cloudflareaccess.com',ACCESS_AUDIENCE:'test-admin-audience',ADMIN_EMAIL_ALLOWLIST:'allowed@example.invalid'};
beforeAll(async()=>{({privateKey,publicKey}=await generateKeyPair('RS256'));});
async function signed(patch:Record<string,unknown>={},key=privateKey){
 return new SignJWT({type:'app',email:'allowed@example.invalid',...patch}).setProtectedHeader({alg:'RS256',kid:'fixture'})
  .setIssuer(typeof patch.iss==='string'?patch.iss:env.ACCESS_ISSUER).setAudience(typeof patch.aud==='string'?patch.aud:env.ACCESS_AUDIENCE).setSubject('fixture-student').setIssuedAt().setExpirationTime(typeof patch.exp==='number'?patch.exp:'10m').sign(key);
}
const request=(token?:string,host='admin.casa-apero.com')=>new Request(`https://${host}/api/admin/orders`,{headers:{...(token?{'Cf-Access-Jwt-Assertion':token}:{}),'Cf-Access-Authenticated-User-Email':'allowed@example.invalid'}});
it('accepts a valid signed Access application JWT and explicit allowlisted identity',async()=>{
 expect(await authorizeAdmin(request(await signed()),env,publicKey as never)).toMatchObject({id:'fixture-student',email:'allowed@example.invalid',local:false});
});
it('rejects absent, spoofed, expired, not-yet-valid and incorrectly scoped credentials',async()=>{
 await expect(authorizeAdmin(request(),env,publicKey as never)).rejects.toMatchObject({status:401});
 for(const patch of [{email:'other@example.invalid'},{aud:'other'},{iss:'https://evil.invalid'},{exp:1},{nbf:Math.floor(Date.now()/1000)+1000},{type:'service'}]){
  await expect(authorizeAdmin(request(await signed(patch)),env,publicKey as never)).rejects.toMatchObject({status:403});
 }
 const other=await generateKeyPair('RS256');
 await expect(authorizeAdmin(request(await signed({},other.privateKey)),env,publicKey as never)).rejects.toMatchObject({status:403});
 const unsigned=btoa(JSON.stringify({alg:'none'}))+'.'+btoa(JSON.stringify({email:'allowed@example.invalid'}))+'.';
 await expect(authorizeAdmin(request(unsigned),env,publicKey as never)).rejects.toMatchObject({status:403});
});
it('denies workers.dev, staging, public and alternate hosts even with a valid JWT',async()=>{
 const token=await signed();
 for(const host of ['casa-apero.com','casa-apero-staging.example.workers.dev','other.example.com','admin.casa-apero.com.evil.invalid'])await expect(authorizeAdmin(request(token,host),env,publicKey as never)).rejects.toMatchObject({status:403});
 for(const patch of [{APP_ENV:'staging'},{APP_ENV:'disabled'},{ACCESS_ISSUER:''},{ACCESS_AUDIENCE:''},{ADMIN_EMAIL_ALLOWLIST:''}])await expect(authorizeAdmin(request(token),{...env,...patch},publicKey as never)).rejects.toMatchObject({status:403});
});
it('local session is signed, loopback-only and rejects cross-origin login or forged cookies',async()=>{
 const localEnv={APP_ENV:'local-admin',ADMIN_AUTH_MODE:'local-session'};
 const loginRequest=new Request('http://127.0.0.1:5180/api/admin/local-login',{method:'POST',headers:{Origin:'http://127.0.0.1:5180'}});
 const response=await localLogin(loginRequest,localEnv);expect(response.status).toBe(204);
 const cookie=response.headers.get('set-cookie')!.split(';')[0];expect(response.headers.get('set-cookie')).toContain('HttpOnly');
 expect(await authorizeAdmin(new Request('http://127.0.0.1:5180/api/admin/orders',{headers:{Cookie:cookie}}),localEnv)).toMatchObject({local:true});
 await expect(authorizeAdmin(new Request('http://127.0.0.1:5180/api/admin/orders',{headers:{Cookie:'casa_admin_local=forged'}}),localEnv)).rejects.toMatchObject({status:401});
 await expect(localLogin(new Request('http://127.0.0.1:5180/api/admin/local-login',{method:'POST',headers:{Origin:'https://evil.invalid'}}),localEnv)).rejects.toMatchObject({status:403});
 await expect(localLogin(new Request('https://admin.casa-apero.com/api/admin/local-login',{method:'POST'}),localEnv)).rejects.toMatchObject({status:403});
});
it('every private route denies access without authentication and public/staging Workers do not expose admin APIs',async()=>{
 for(const path of ['session','orders','products','events','report','audit','settings','export']){
  for(const method of ['GET','PUT','POST']){
   const response=await adminWorker.fetch(new Request(`http://127.0.0.1:5180/api/admin/${path}`,{method}),{APP_ENV:'local-admin',ADMIN_AUTH_MODE:'local-session'});
   expect(response.status).toBe(401);expect(response.headers.get('Cache-Control')).toContain('no-store');
  }
  expect((await publicWorker.fetch(new Request(`https://casa-apero.com/api/admin/${path}`),{APP_ENV:'disabled',TURNSTILE_MODE:'disabled'})).status).toBe(403);
  expect((await staging.fetch(new Request(`https://staging.workers.dev/api/admin/${path}`),{} as never)).status).toBe(403);
 }
 expect((await adminWorker.fetch(new Request('https://casa-apero.com/'),env)).status).toBe(403);
});
