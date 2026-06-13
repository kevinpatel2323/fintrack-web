import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser talks to the API only through the same-origin `/api` prefix so
// that auth cookies are first-party (see src/services/http.js). In dev we proxy
// `/api/*` to the local Nest server on :3000 (which has no global path prefix,
// so we strip `/api`). In prod the same prefix is rewritten by vercel.json.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
