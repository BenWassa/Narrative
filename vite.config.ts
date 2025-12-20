import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

export default defineConfig({
  base: '/Narrative/',
  plugins: [react()],
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
