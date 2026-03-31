import { resolve } from 'path'
import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { readFileSync, writeFileSync } from 'fs'

// Strip the vite-plugin-pwa injected manifest link from aprovaai.html
// after the entire build (including PWA plugin) is complete
function stripPwaManifestFromAprovAi(): Plugin {
  return {
    name: 'strip-pwa-manifest-aprovaai',
    enforce: 'post',
    closeBundle() {
      const file = resolve(__dirname, 'dist', 'aprovaai.html')
      try {
        const html = readFileSync(file, 'utf-8')
        const fixed = html.replace(/<link rel="manifest" href="\/manifest\.webmanifest">/g, '')
        writeFileSync(file, fixed, 'utf-8')
      } catch {
        // file may not exist in dev mode
      }
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    stripPwaManifestFromAprovAi(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png', 'sounds/*.mp3'],
      manifest: {
        name: 'TEG+ ERP',
        short_name: 'TEG+',
        description: 'Sistema de Gestão TEG+ — ERP movido por IA',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#060D1B',
        background_color: '#060D1B',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Compras', short_name: 'Compras', url: '/compras', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Financeiro', short_name: 'Financeiro', url: '/financeiro', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Estoque', short_name: 'Estoque', url: '/estoque', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globIgnores: ['**/bg-*.png', '**/node_modules/**'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
          {
            urlPattern: /^https:\/\/uzfjfucrinokeuwpbeie\.supabase\.co\/rest\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/uzfjfucrinokeuwpbeie\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'supabase-storage-cache', expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, host: '127.0.0.1' },
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        aprovaai: resolve(__dirname, 'aprovaai.html'),
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
