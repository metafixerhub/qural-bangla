import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    chunkSizeWarningLimit: 2000
  },
  server: {
    port: 3000,
    open: true
  }
});
