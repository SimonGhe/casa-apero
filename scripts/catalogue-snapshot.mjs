// Local-only publication artifact. Never reads remote D1 or private/customer tables.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {PUBLIC_PRODUCT_SQL,projectCatalogue} from '../worker/catalogue.ts';
import {validateCatalogue} from '../shared/catalogue.ts';
const file='src/data/catalogue.snapshot.json',mode=process.argv[2];
if(mode==='--check'){const data=validateCatalogue(JSON.parse(readFileSync(file,'utf8')));console.log(`PASS: generated snapshot schema, ${data.products.length} published products; no remote access.`);process.exit(0);}
if(!['--local','--seed','--diff'].includes(mode))throw new Error('Use --check, --local, --diff or --seed. Remote export is not supported.');
let data;
if(mode==='--seed'){
 const db=new DatabaseSync(':memory:');for(const name of readdirSync('migrations').filter(name=>/^\d+.*\.sql$/.test(name)).sort())db.exec(readFileSync('migrations/'+name,'utf8'));
 data=projectCatalogue(db.prepare(PUBLIC_PRODUCT_SQL).all(),db.prepare("SELECT value FROM application_settings WHERE key='orders_paused'").get()?.value??null);db.close();
}else{
 const sql=`SELECT public_product.*,(SELECT value FROM application_settings WHERE key='orders_paused') AS global_pause FROM (${PUBLIC_PRODUCT_SQL}) public_product`;
 const r=spawnSync(process.platform==='win32'?'pnpm.cmd':'pnpm',['exec','wrangler','d1','execute','DB','--local','--config','wrangler.local.jsonc','--command',process.platform==='win32'?`"${sql}"`:sql,'--json'],{encoding:'utf8',shell:process.platform==='win32'});
 if(r.status!==0)throw new Error('Local D1 export failed. Run pnpm db:migrate first.');
 const rows=JSON.parse(r.stdout)[0].results;if(!rows.length)throw new Error('Empty local catalogue: review explicitly before generating a static snapshot.');
 data=projectCatalogue(rows,rows[0].global_pause??null);
}
if(mode==='--diff'){
 const frozen=validateCatalogue(JSON.parse(readFileSync(file,'utf8'))),changed=JSON.stringify(frozen)!==JSON.stringify(data);
 if(changed){for(const product of data.products){const previous=frozen.products.find(p=>p.id===product.id);if(JSON.stringify(previous)!==JSON.stringify(product))console.log(`Review ${product.id}: local D1 product differs from snapshot.`);}for(const product of frozen.products)if(!data.products.some(p=>p.id===product.id))console.log(`Review ${product.id}: no longer published.`);if(JSON.stringify(frozen.shopSettings)!==JSON.stringify(data.shopSettings))console.log('Review global ordering pause.');}
 console.log(changed?'DRIFT: review local D1 before regenerating the static artifact.':'PASS: local D1 and the static snapshot agree. No files changed.');process.exit(changed?1:0);
}
writeFileSync(file,JSON.stringify(data,null,2)+'\n');console.log(`Generated ${file} from ${mode==='--seed'?'fresh local migrations':'local D1'}. Review the diff before any approved publication. No deployment performed.`);
