import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Gelistirme sirasinda /api istekleri backend'e proxy'lenir.
// Boylece mobil uygulamada (Capacitor) ve tarayici onizlemesinde ayni goreli URL'ler calisir:
// hicbir zaman tarayicidan localhost'a istek atilmaz.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: true },
    },
  },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  build: { outDir: 'dist', target: 'es2020', sourcemap: false },
});
