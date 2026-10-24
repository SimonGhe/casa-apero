import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { approvedPublicEmail } from './src/lib/publicContact.ts';

export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'CASA_'), ...process.env };
  const staging = mode === 'staging';
  const admin = mode === 'admin';
  return {
    cacheDir: admin ? '.vite/admin' : staging ? '.vite/staging' : '.vite/storefront',
    plugins: [react(), tailwindcss(), cloudflare({
      configPath: admin ? command === 'serve' ? 'wrangler.admin.local.jsonc' : 'wrangler.admin.jsonc' : staging ? 'wrangler.staging.jsonc' : command === 'serve' && mode !== 'production' ? 'wrangler.local.jsonc' : 'wrangler.jsonc',
      viteEnvironment: { name: 'worker' },
    }), ...(admin ? [{name:'admin-entry',transformIndexHtml:{order:'pre' as const,handler:(html:string)=>html.replace('/src/main.tsx','/src/admin/main.tsx')}}] : [])],
    build: { outDir: admin ? 'dist-admin' : staging ? 'dist-staging' : 'dist', sourcemap: false },
    environments: { worker: { build: { sourcemap: !staging&&!admin } } },
    define: {
      __CASA_PUBLIC_CONTACT_EMAIL__: JSON.stringify(approvedPublicEmail(
        env.CASA_PUBLIC_CONTACT_EMAIL, env.CASA_PUBLIC_CONTACT_EMAIL_APPROVED,
      )),
    },
    server: { host: '127.0.0.1', port: admin ? 5180 : 5173, strictPort: true },
  };
});
