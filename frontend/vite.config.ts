import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'portal',
      remotes: {
        shield: '/shield/assets/remoteEntry.js',
        proto: '/proto/assets/remoteEntry.js',
        pipeline: '/pipeline/assets/remoteEntry.js',
        pdm: '/pdm/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom', 'react-router-dom']
    })
  ],
  build: {
    target: 'esnext'
  },
  server: {
    port: 5173,
    proxy: {
      // Local dev proxy to redirect subpath requests to running sub-apps
      '/shield': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
      '/proto': {
        target: 'http://localhost:5175',
        changeOrigin: true,
      },
      '/pipeline': {
        target: 'http://localhost:5176',
        changeOrigin: true,
      },
      '/pdm': {
        target: 'http://localhost:5177',
        changeOrigin: true,
      },
      // Backend API proxy (forwarding /api calls to the backend server)
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
