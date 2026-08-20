import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import federation from '@originjs/vite-plugin-federation'
import { versionTrackerPlugin } from '../../code-common/build-utils/versionTrackerPlugin'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    versionTrackerPlugin({ appName: 'code-bench' }),
    federation({
      name: 'portal',
      remotes: {
        shield: '/shield/assets/remoteEntry.js',
        proto: '/proto/assets/remoteEntry.js',
        pipeline: '/pipeline/assets/remoteEntry.js',
        pdm: '/pdm/assets/remoteEntry.js',
      },
      shared: ['react', 'react-dom', 'react-router-dom'],
    }),
  ],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
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
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
