import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig(({ mode }) => {
  // Load the appropriate manifest based on the build mode
  let manifestPath = './src/manifest.json';

  if (mode === 'firefox') {
    manifestPath = './src/manifest.firefox.json';
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Define rollup input properly to avoid TypeScript error
  const rollupInput = mode === 'firefox'
    ? undefined  // Firefox doesn't support offscreen documents
    : {
      offscreen: resolve(__dirname, 'src/offscreen.html'),
    };

  return {
    root: resolve(__dirname, 'src'),
    plugins: [
      react(),
      crx({ manifest }),
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
        input: rollupInput,
      },
    },
    // Use relative paths for extension compatibility (absolute paths don't work in extensions)
    base: '',
    publicDir: resolve(__dirname, 'public'),
  };
});