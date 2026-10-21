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
        // so previously viewed recipes are available offline. Navnene må
        // stemme med src/lib/offlineCache.ts, som tømmer API-lageret ved
        // utlogging.
        runtimeCaching: [
          {
            // Data fra databasen: nettet først, men gir opp etter 3 sekunder
            // og bruker sist lagrede svar, så dårlig dekning ikke låser appen.
            // Bare /rest/v1, ikke innlogging (/auth/v1).
            urlPattern: ({ url }) => url.hostname.endsWith('supabase.co') && url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Oppskriftsbilder endres aldri (nytt bilde får nytt filnavn), så
            // de hentes fra lageret uten å spørre nettet.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('supabase.co') && url.pathname.startsWith('/storage/v1/object/public/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-images',
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
