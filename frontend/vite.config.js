/* global process */
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the API is proxied, so the browser talks to a single origin (no CORS setup needed).
    proxy: { '/api': { target: process.env.VITE_DEV_API || 'http://localhost:3000', changeOrigin: true } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    css: false,
  },
})
