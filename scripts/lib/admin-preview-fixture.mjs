// LOCAL TEST HARNESS ONLY. Not imported by Vite, the frontend or any Worker.
// Virtual HTTPS requests go to Miniflare; JWKS is served from an in-memory key.
// This does not authenticate against Cloudflare Access or send an OTP.
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
export async function createAdminPreviewFixture(){
 const origin='https://admin.casa-apero.com',issuer='https://local-preview-fixture.cloudflareaccess.com';
 const pair=await generateKeyPair('RS256'),jwks={keys:[{...await exportJWK(pair.publicKey),kid:'local-preview-key',alg:'RS256',use:'sig'}]};
 const config=JSON.parse(await readFile('dist-admin-preview/worker/wrangler.json','utf8'));
 if(config.name!=='casa-apero-admin-staging'||config.workers_dev!==false||config.preview_urls!==false||config.d1_databases.length!==1||config.d1_databases[0].database_name!=='casa-apero-admin-staging')throw new Error('Unexpected preview artifact; build:admin-preview first.');
 const mf=new Miniflare(convertV4MiniflareOptions({workers:[{
  name:'local-admin-preview-fixture',modules:true,scriptPath:resolve('dist-admin-preview/worker/index.js'),compatibilityDate:'2026-10-24',
  bindings:{...config.vars,ACCESS_ISSUER:issuer,ACCESS_AUDIENCE:'fixture-audience',ADMIN_EMAIL_ALLOWLIST:'student@example.invalid'},
  d1Databases:['DB'],assets:{directory:resolve('dist-admin-preview/client'),binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true},assetConfig:{not_found_handling:'single-page-application'}},
  outboundService:async(request)=>{
   if(request.url===`${issuer}/cdn-cgi/access/certs`)return new Response(JSON.stringify(jwks),{headers:{'Content-Type':'application/json'}});
   throw new Error('External traffic prohibited by local test harness.');
  },
 }]}));
 try{
  const db=await mf.getD1Database('DB');
  for(const path of ['migrations/0001_schema.sql','migrations/0002_catalogue.sql','migrations/0003_administration.sql','preview/admin-fixtures.sql']){
   const sql=(await readFile(path,'utf8')).split('\n').filter(line=>!line.trim().startsWith('--')).join(' ');await db.exec(sql);
  }
  const token=await new SignJWT({email:'student@example.invalid',type:'app'}).setSubject('fictional-preview-student').setProtectedHeader({alg:'RS256',kid:'local-preview-key'}).setIssuer(issuer).setAudience('fixture-audience').setIssuedAt().setExpirationTime('10m').sign(pair.privateKey);
  return {origin,dispose:()=>mf.dispose(),fetch:(path,{authenticated=true,method='GET',body,headers={},host=origin}={})=>mf.dispatchFetch(new URL(path,host),{
   method,headers:{Origin:origin,...(authenticated?{'Cf-Access-Jwt-Assertion':token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)}),
  })};
 }catch(error){await mf.dispose();throw error;}
}
