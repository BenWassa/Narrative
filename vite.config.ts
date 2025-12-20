import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Narrative/',
  plugins: [react()],
  build: {
    // Output site to docs/ so GitHub Pages can serve the app at the repo root.
    outDir: 'docs',
    // Preserve any existing docs content in docs/.
    emptyOutDir: false,
  },
});
