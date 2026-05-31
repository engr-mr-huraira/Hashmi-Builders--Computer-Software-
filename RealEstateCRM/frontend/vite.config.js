import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Use relative base ('./') so the built index.html works under the file:// protocol
// when loaded by Electron in production.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false,
  },
})
