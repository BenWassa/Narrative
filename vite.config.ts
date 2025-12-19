import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // Output site to docs/site so the docs/ folder can hold other static pages
    outDir: 'docs/site'
  }
})
