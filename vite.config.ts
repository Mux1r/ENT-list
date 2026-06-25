import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/ENT-list/', // 設定 GitHub Pages 的專案名稱路徑
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Patient List',
          short_name: 'Patient List',
          description: 'ENT Ward Patient Management',
          theme_color: '#1A6FA8',
          background_color: '#1A6FA8',
          display: 'standalone',
          start_url: '/ENT-list/',
          scope: '/ENT-list/',
          icons: [
            { src: '/ENT-list/icons/icon.svg', sizes: '192x192', type: 'image/svg+xml' },
            { src: '/ENT-list/icons/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
          ],
        },
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
