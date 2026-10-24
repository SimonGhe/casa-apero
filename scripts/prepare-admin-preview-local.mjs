import {spawnSync} from 'node:child_process';
// Hard-coded local-only commands. This script never selects a remote resource.
const config='wrangler.admin.preview.jsonc',persist='.wrangler/admin-preview-state';
for(const args of [
 ['exec','wrangler','d1','migrations','apply','DB','--local','--config',config,'--persist-to',persist],
 ['exec','wrangler','d1','execute','DB','--local','--config',config,'--persist-to',persist,'--file','preview/admin-fixtures.sql'],
]){
 const result=spawnSync(process.platform==='win32'?'pnpm.cmd':'pnpm',args,{stdio:'inherit',shell:process.platform==='win32'});
 if(result.error)throw result.error;if(result.status!==0)process.exit(result.status??1);
}
