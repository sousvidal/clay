import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Thin wrapper so the shadcn CLI can detect the Vite/React setup.
// The real build config lives in electron.vite.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
    },
  },
  plugins: [react(), tailwindcss()],
})
