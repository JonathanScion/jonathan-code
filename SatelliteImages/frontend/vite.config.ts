import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const basePath = '/';

  return {
    base: basePath,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared/src')
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true
        },
        '/files': {
          target: 'http://localhost:3001',
          changeOrigin: true
        }
      }
    },
    define: {
      // For Cesium - use base path in production
      CESIUM_BASE_URL: JSON.stringify('/cesium')
    },
    build: {
      outDir: 'dist',
      sourcemap: true
    }
  };
});
