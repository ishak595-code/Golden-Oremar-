import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      workbox: {
        // The legacy admin/Firebase bundle is deliberately lazy. Ordinary customers must not
        // download ~1 MB of back-office code in the service-worker install precache.
        // Admin remains available online through the existing dynamic import when authorized.
        globIgnores: ['**/LegacyAdminEntry-*.js'],
      },
      manifest: {
        id: '/',
        name: 'Golden Oremar',
        short_name: 'Oremar',
        description: 'Doğrulanmış üreticilerden köy ve yöresel ürünleri keşfetme ve sipariş etme uygulaması.',
        lang: 'tr',
        start_url: '/?tab=home',
        scope: '/',
        theme_color: '#16A34A',
        background_color: '#ffffff',
        display: 'standalone',
        categories: ['shopping', 'food'],
        icons: [
          {
            src: 'logo.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'logo.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // File watching can be disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
}));
