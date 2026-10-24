// Read-only artifact verification. Does not deploy or contact Cloudflare.
import {readFile,readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const config=JSON.parse(await readFile('dist-test-checkout/worker/wrangler.json','utf8')),vars=config.vars;
assert.equal(config.name,'casa-apero-staging');assert.equal(config.workers_dev,true);assert.equal(config.preview_urls,false);assert.equal(config.upload_source_maps,false);assert.equal(config.assets.run_worker_first,true);
assert.equal(config.routes?.length??0,0);assert(!config.route);assert.equal(config.d1_databases.length,1);assert.equal(config.d1_databases[0].binding,'DB');assert.equal(config.d1_databases[0].database_name,'casa-apero-admin-staging');assert.equal(config.d1_databases[0].database_id,'f8c58abc-95ab-4fd9-8279-5f0f0f2ada83');
for(const key of ['kv_namespaces','services','r2_buckets'])assert.equal(config[key]?.length??0,0,`Unexpected binding ${key}`);
assert.equal(config.queues?.producers?.length??0,0);assert.equal(config.queues?.consumers?.length??0,0);assert.equal(config.durable_objects?.bindings?.length??0,0);
assert.equal(vars.APP_ENV,'test-checkout');assert.equal(vars.CHECKOUT_ENABLED,'false');assert.equal(vars.TEST_CHECKOUT_DATASET,'casa-apero-admin-staging-fictional-v1');assert.equal(vars.TURNSTILE_MODE,'siteverify');assert(!Object.hasOwn(vars,'TURNSTILE_SECRET_KEY'),'Turnstile secret must be a Worker secret, not build config');
const files=await readdir('dist-test-checkout/client/assets'),client=(await Promise.all(files.filter(f=>f.endsWith('.js')).map(f=>readFile('dist-test-checkout/client/assets/'+f,'utf8')))).join('');
for(const marker of ['TEST_CHECKOUT_ALLOWED_EMAILS','TEST_CHECKOUT_AUDIENCE','TEST_CHECKOUT_ISSUER','TURNSTILE_SECRET_KEY','Cf-Access-Jwt-Assertion','fixture-server-only-secret','local-test-token','casa_admin_local'])assert(!client.includes(marker),`Private/test marker leaked: ${marker}`);
for(const key of ['TEST_CHECKOUT_ALLOWED_EMAILS','TEST_CHECKOUT_AUDIENCE','TEST_CHECKOUT_ISSUER','ADMIN_ACCESS_AUDIENCE'])if(vars[key])assert(!client.includes(vars[key]),`Server configuration leaked: ${key}`);
const worker=await readFile('dist-test-checkout/worker/index.js','utf8');for(const marker of ['casa_admin_local=','fictional-browser-tester','checkout-browser-fixture'])assert(!worker.includes(marker),`Local fixture in Worker: ${marker}`);
assert(!files.some(f=>f.endsWith('.map')));
if(process.argv.includes('--configured')){
 assert.equal(vars.TEST_CHECKOUT_ENABLED,'true');assert.match(vars.TEST_CHECKOUT_ISSUER,/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/);assert.match(vars.TEST_CHECKOUT_AUDIENCE,/^[a-f0-9]{64}$/i);assert.match(vars.ADMIN_ACCESS_AUDIENCE,/^[a-f0-9]{64}$/i);assert.notEqual(vars.TEST_CHECKOUT_AUDIENCE,vars.ADMIN_ACCESS_AUDIENCE);
 assert(vars.TEST_CHECKOUT_ALLOWED_EMAILS&&vars.TEST_CHECKOUT_ALLOWED_EMAILS.split(',').every(s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())));assert(vars.TURNSTILE_SITE_KEY&&!/^(?:1x|2x|3x)/.test(vars.TURNSTILE_SITE_KEY));
 console.log('PASS: configured artifact. Live Access paths/policies, Turnstile secret, DB backup/ledger and owner approval still require deployment preflight.');
}else console.log('PASS: isolated checkout artifact and private configuration boundaries. Enabled/configured deployment is NOT implied.');
