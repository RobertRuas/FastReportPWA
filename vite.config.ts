import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/FastReportPWA/' : '/',
  define: {
    // Build timestamp. On GitHub Actions the build IS the deploy, so this is
    // the date/time of the last deploy shown in the Home footer.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __IS_GITHUB_BUILD__: JSON.stringify(!!process.env.GITHUB_ACTIONS)
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json,woff2,woff,ttf,eot}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/]
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
