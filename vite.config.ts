import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the user taps the update banner
      // (src/components/UpdateBanner.tsx) instead of activating silently.
      registerType: 'prompt',
      includeAssets: ['favicon-32.png', 'apple-touch-icon-180.png'],
      manifest: {
        name: 'Kokeboka',
        short_name: 'Kokeboka',
        description: 'Oppskriftene dine, samlet.',
        theme_color: '#efe4d2',
        background_color: '#efe4d2',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Push-varsel når en nedtelling i kokemodus er ferdig (public/timer-push-sw.js).
        importScripts: ['timer-push-sw.js'],
        // Cache the app shell + any recipe data/images fetched from Supabase,
        // so previously viewed recipes are available offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})
