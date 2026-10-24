import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const configPath = 'dist-staging/worker/wrangler.json';
const config = JSON.parse(await readFile(configPath, 'utf8'));
if (config.name !== 'casa-apero-staging' || config.workers_dev !== true || config.preview_urls !== false
  || config.vars?.APP_ENV !== 'staging' || config.vars?.CHECKOUT_ENABLED !== 'false'
  || config.assets?.run_worker_first !== true || config.assets?.binding !== 'ASSETS'
  || config.routes?.length || config.route || config.d1_databases?.length
  || config.kv_namespaces?.length || config.services?.length || config.r2_buckets?.length
  || config.durable_objects?.bindings?.length || config.upload_source_maps) {
  throw new Error('Staging artifact failed isolation checks. Build staging again; deployment refused.');
}
const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['exec', 'wrangler', 'deploy', '--config', configPath], {
  stdio: 'inherit', shell: process.platform === 'win32',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
