import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createAdminPreviewFixture} from './lib/admin-preview-fixture.mjs';
const runtime=await createAdminPreviewFixture();
try{
 for(const path of ['/','/api/admin/session','/api/admin/orders','/api/admin/report','/api/admin/export']){
  assert.equal((await runtime.fetch(path,{authenticated:false})).status,401);
  assert.equal((await runtime.fetch(path)).status,200);
 }
 assert.equal((await runtime.fetch('/api/admin/orders',{host:'https://casa-apero-admin-staging.example.workers.dev'})).status,403);
 for(const path of ['/api/requests','/api/orders','/api/quote','/api/admin/local-login'])assert.equal((await runtime.fetch(path,{method:'POST',body:{}})).status,403);
 const session=await(await runtime.fetch('/api/admin/session')).json();assert.equal(session.writesEnabled,false);assert.equal(session.local,false);
 const worker=await readFile('dist-admin-preview/worker/index.js','utf8');
 for(const marker of ['casa-apero-local-admin','casa_admin_local=','fictional-admin'])assert.equal(worker.includes(marker),false,`Local simulation found: ${marker}`);
 const files=await readdir('dist-admin-preview/client/assets');
 const client=(await Promise.all(files.filter(x=>x.endsWith('.js')).map(x=>readFile('dist-admin-preview/client/assets/'+x,'utf8')))).join('');
 for(const marker of ['Lokale testbeheerder starten','ADMIN_EMAIL_ALLOWLIST','ACCESS_AUDIENCE','Cf-Access-Jwt-Assertion','local-admin-preview-fixture'])assert.equal(client.includes(marker),false,`Private/test marker found: ${marker}`);
 const config=JSON.parse(await readFile('dist-admin-preview/worker/wrangler.json','utf8'));
 for(const name of ['ACCESS_ISSUER','ACCESS_AUDIENCE','ADMIN_EMAIL_ALLOWLIST'])if(config.vars[name])assert.equal(client.includes(config.vars[name]),false,`Server configuration leaked: ${name}`);
 console.log('PASS: compiled workerd preview + local D1 + signed fixture/JWKS, authorized 200, unauthorized 401, alternate hosts/order/login endpoints 403.');
 console.log('PASS: read-only capabilities and deployed artifact isolation. No external requests, live Access login, OTP, deployment or Cloudflare changes.');
}finally{await runtime.dispose();}
