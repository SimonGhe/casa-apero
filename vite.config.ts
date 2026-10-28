import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import { approvedPublicEmail } from './src/lib/publicContact.ts';
import { fileURLToPath } from 'node:url';
import { adminPreviewAccessConfig } from './src/lib/adminPreviewConfig.ts';
import {testCheckoutConfig} from './src/lib/testCheckoutConfig.ts';
import {legalVersion} from './src/data/legal.ts';

export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'CASA_'), ...process.env };
  const staging = mode === 'staging';
  const testCheckout = mode === 'test-checkout';
  const shop=mode==='shop',adminProduction=mode==='admin-production';
  const adminPreview = mode === 'admin-preview';
  const admin = mode === 'admin' || adminPreview || adminProduction;
  const deployedAdmin = admin && (command === 'build' || adminPreview);
  const deployedAuth = fileURLToPath(new URL('./worker/admin/auth.deployed.ts',import.meta.url));
  return {
    cacheDir: adminPreview ? '.vite/admin-preview' : admin ? '.vite/admin' : staging ? '.vite/staging' : '.vite/storefront',
    resolve: {alias:deployedAdmin?[{find:'./auth',replacement:deployedAuth},{find:'./admin/auth',replacement:deployedAuth}]:[]},
    plugins: [react(), tailwindcss(), cloudflare({
      configPath: shop?'wrangler.shop.jsonc':adminProduction?'wrangler.admin.production.jsonc':testCheckout ? 'wrangler.checkout.preview.jsonc' : adminPreview ? 'wrangler.admin.preview.jsonc' : admin ? command === 'serve' ? 'wrangler.admin.local.jsonc' : 'wrangler.admin.jsonc' : staging ? 'wrangler.staging.jsonc' : command === 'serve' && mode !== 'production' ? 'wrangler.local.jsonc' : 'wrangler.jsonc',
      ...(shop?{config:(config)=>({vars:{...config.vars,PUBLIC_ORDERS_ENABLED:env.CASA_PUBLIC_ORDERS_ENABLED==='true'?'true':'false',LEGAL_VERSION:legalVersion,TURNSTILE_SITE_KEY:env.CASA_SHOP_TURNSTILE_SITE_KEY??''}}),persistState:{path:'.wrangler/shop-local-state'}}:{}),
      ...(adminProduction?{config:(config)=>({vars:{...config.vars,...adminPreviewAccessConfig({CASA_ADMIN_PREVIEW_ACCESS_ISSUER:env.CASA_ADMIN_ACCESS_ISSUER,CASA_ADMIN_PREVIEW_ACCESS_AUDIENCE:env.CASA_ADMIN_ACCESS_AUDIENCE,CASA_ADMIN_PREVIEW_ADMIN_EMAIL_ALLOWLIST:env.CASA_ADMIN_EMAIL_ALLOWLIST}),ADMIN_WRITES_ENABLED:env.CASA_PRODUCTION_ADMIN_WRITES_ENABLED==='true'?'true':'false'}}),persistState:{path:'.wrangler/shop-local-state'}}:{}),
      ...(testCheckout?{config:(config)=>({vars:{...config.vars,...testCheckoutConfig(env)}}),persistState:{path:'.wrangler/test-checkout-state'}}:{}),
      ...(adminPreview?{config:(config)=>({vars:{...config.vars,...adminPreviewAccessConfig(env)}}),persistState:{path:'.wrangler/admin-preview-state'}}:{}),
      viteEnvironment: { name: 'worker' },
    }), ...(admin ? [{name:'admin-entry',transformIndexHtml:{order:'pre' as const,handler:(html:string)=>html.replace('/src/main.tsx','/src/admin/main.tsx')}}] : [])],
    build: { outDir: shop?'dist-shop':adminProduction?'dist-admin-production':testCheckout ? 'dist-test-checkout' : adminPreview ? 'dist-admin-preview' : admin ? 'dist-admin' : staging ? 'dist-staging' : 'dist', sourcemap: false },
    environments: { worker: { build: { sourcemap: !staging&&!admin&&!testCheckout&&!shop } } },
    define: {
      __CASA_PUBLIC_CONTACT_EMAIL__: JSON.stringify(approvedPublicEmail(
        env.CASA_PUBLIC_CONTACT_EMAIL, env.CASA_PUBLIC_CONTACT_EMAIL_APPROVED,
      )),
    },
    server: { host: '127.0.0.1', port: adminPreview ? 5185 : admin ? 5180 : 5173, strictPort: true },
  };
});
