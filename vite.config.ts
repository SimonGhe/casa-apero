import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { approvedPublicEmail } from './src/lib/publicContact.ts';

export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'CASA_'), ...process.env };
  const staging = mode === 'staging';
  return {
    plugins: [react(), tailwindcss(), cloudflare({
      configPath: staging ? 'wrangler.staging.jsonc' : command === 'serve' && mode !== 'production' ? 'wrangler.local.jsonc' : 'wrangler.jsonc',
      viteEnvironment: { name: 'worker' },
    })],
    build: { outDir: staging ? 'dist-staging' : 'dist', sourcemap: false },
    environments: { worker: { build: { sourcemap: !staging } } },
    define: {
      __CASA_PUBLIC_CONTACT_EMAIL__: JSON.stringify(approvedPublicEmail(
        env.CASA_PUBLIC_CONTACT_EMAIL, env.CASA_PUBLIC_CONTACT_EMAIL_APPROVED,
      )),
    },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
  };
});
