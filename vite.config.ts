import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { approvedPublicEmail } from './src/lib/publicContact.ts';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'CASA_'), ...process.env };
  return {
    plugins: [react(), tailwindcss()],
    define: {
      __CASA_PUBLIC_CONTACT_EMAIL__: JSON.stringify(approvedPublicEmail(
        env.CASA_PUBLIC_CONTACT_EMAIL, env.CASA_PUBLIC_CONTACT_EMAIL_APPROVED,
      )),
    },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
  };
});
