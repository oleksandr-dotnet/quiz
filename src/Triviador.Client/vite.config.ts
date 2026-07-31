import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:5106',
      '/hub': { target: 'http://localhost:5106', ws: true },
    },
  },
  build: {
    outDir: '../Triviador.Server/wwwroot',
    emptyOutDir: true,
  },
})
