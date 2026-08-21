import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const vendorChunk = (id: string) => {
  if (!id.includes('node_modules')) return undefined;

  if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
    return 'vendor-react';
  }

  if (id.includes('/@supabase/') || id.includes('/ws/')) {
    return 'vendor-supabase';
  }

  if (id.includes('/@capacitor/')) {
    return 'vendor-capacitor';
  }

  if (id.includes('/lucide-react/')) {
    return 'vendor-icons';
  }

  return undefined;
};

export default defineConfig(() => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Keep the service worker out of the Vite development runtime so HMR and
      // accessibility/debug sessions cannot be served stale cached application code.
      devOptions: {
        enabled: false,
      },
      workbox: {
        // Back-office modules are lazy and excluded from customer precache. They are
        // fetched only after an authorized admin or producer opens the management UI.
        globIgnores: ['**/Admin*.js'],
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
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // File watching can be disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
}));
