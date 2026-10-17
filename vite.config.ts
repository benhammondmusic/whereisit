import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Pages Functions run under `wrangler pages dev` on 8788 (see `npm run dev`).
    proxy: { '/api': 'http://localhost:8788' },
  },
})
