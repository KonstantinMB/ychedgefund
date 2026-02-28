import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './src',
  publicDir: '../public',

  build: {
    outDir: '../dist',
    emptyOutDir: true,

    // Performance optimizations
    target: 'es2020',
    minify: 'esbuild',

    // Bundle size limits - WorldMonitor is ~250KB, we target <300KB
    chunkSizeWarningLimit: 300,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
      },
      output: {
        manualChunks: {
          'deck-gl': [
            '@deck.gl/core',
            '@deck.gl/layers',
            '@deck.gl/geo-layers',
            '@deck.gl/mapbox',
          ],
          'maplibre': ['maplibre-gl'],
        },
      },
    },

    // Source maps for debugging
    sourcemap: true,
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@api': resolve(__dirname, './api'),
    },
  },

  server: {
    port: 3000,
    open: true,
    cors: true,
  },

  preview: {
    port: 3000,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      '@deck.gl/core',
      '@deck.gl/layers',
      '@deck.gl/geo-layers',
      '@deck.gl/mapbox',
      'maplibre-gl',
    ],
  },
});
