import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist/webview',
    rollupOptions: {
      input: 'src/webview/main.tsx',
      output: {
        entryFileNames: 'main.js',
        assetFileNames: 'main.[ext]',
        chunkFileNames: '[name].js',
      },
    },
  },
})
