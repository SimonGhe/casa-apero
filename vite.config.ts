import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { approvedPublicEmail } from './src/lib/publicContact.ts';
import { fileURLToPath } from 'node:url';
import { adminPreviewAccessConfig } from './src/lib/adminPreviewConfig.ts';

export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'CASA_'), ...process.env };
  const staging = mode === 'staging';
  const adminPreview = mode === 'admin-preview';
  const admin = mode === 'admin' || adminPreview;
  const deployedAdmin = admin && (command === 'build' || adminPreview);
  const deployedAuth = fileURLToPath(new URL('./worker/admin/auth.deployed.ts',import.meta.url));
  return {
    cacheDir: adminPreview ? '.vite/admin-preview' : admin ? '.vite/admin' : staging ? '.vite/staging' : '.vite/storefront',
    resolve: {alias:deployedAdmin?[{find:'./auth',replacement:deployedAuth},{find:'./admin/auth',replacement:deployedAuth}]:[]},
    plugins: [react(), tailwindcss(), cloudflare({
      configPath: adminPreview ? 'wrangler.admin.preview.jsonc' : admin ? command === 'serve' ? 'wrangler.admin.local.jsonc' : 'wrangler.admin.jsonc' : staging ? 'wrangler.staging.jsonc' : command === 'serve' && mode !== 'production' ? 'wrangler.local.jsonc' : 'wrangler.jsonc',
      ...(adminPreview?{config:(config)=>({vars:{...config.vars,...adminPreviewAccessConfig(env)}}),persistState:{path:'.wrangler/admin-preview-state'}}:{}),
      viteEnvironment: { name: 'worker' },
    }), ...(admin ? [{name:'admin-entry',transformIndexHtml:{order:'pre' as const,handler:(html:string)=>html.replace('/src/main.tsx','/src/admin/main.tsx')}}] : [])],
    build: { outDir: adminPreview ? 'dist-admin-preview' : admin ? 'dist-admin' : staging ? 'dist-staging' : 'dist', sourcemap: false },
    environments: { worker: { build: { sourcemap: !staging&&!admin } } },
    define: {
      __CASA_PUBLIC_CONTACT_EMAIL__: JSON.stringify(approvedPublicEmail(
        env.CASA_PUBLIC_CONTACT_EMAIL, env.CASA_PUBLIC_CONTACT_EMAIL_APPROVED,
      )),
    },
    server: { host: '127.0.0.1', port: adminPreview ? 5185 : admin ? 5180 : 5173, strictPort: true },
  };
});
