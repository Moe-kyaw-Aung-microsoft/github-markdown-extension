import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import manifest from './src/manifest.json';

// Add offscreen.html to manifest for crxjs
const manifestWithOffscreen = {
  ...manifest,
  // offscreen.html is automatically picked up if listed in manifest
  // but we handle it via HTML entry point instead
};

export default defineConfig(({ mode }) => ({
  root: resolve(__dirname, 'src'),
  plugins: [
    react(),
    crx({ manifest: manifestWithOffscreen }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: mode === 'development',
    minify: mode === 'production',
    rollupOptions: {
      input: {
        offscreen: resolve(__dirname, 'src/offscreen.html'),
      },
    },
  },
  publicDir: resolve(__dirname, 'public'),
}));