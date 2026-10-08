import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: '/assets/',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '^/backend/': {
        target: 'http://localhost:8091',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'main.js'),
      }
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: true,
  }
});
