import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The React frontend runs on :5173 and proxies /api calls to the Express
// server on :8787, which holds the Anthropic API key (never shipped to browser).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
