import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, copyFileSync } from 'fs';
import { resolve } from 'path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  base: '/Narrative/',
  plugins: [
    react(),
    {
      name: 'copy-package-json',
      writeBundle() {
        // Copy package.json to docs directory for runtime version fetching
        copyFileSync(resolve('./package.json'), resolve('./docs/package.json'));
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/features': resolve(__dirname, './src/features'),
      '@/components': resolve(__dirname, './src/components'),
      '@/hooks': resolve(__dirname, './src/hooks'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/types': resolve(__dirname, './src/types'),
      '@/styles': resolve(__dirname, './src/styles'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Output site to docs/ so GitHub Pages can serve the app at the repo root.
    outDir: 'docs',
    // Preserve any existing docs content in docs/.
    emptyOutDir: false,
  },
});
