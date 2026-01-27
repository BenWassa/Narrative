import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
    testTimeout: 30000, // 30 seconds per test
    hookTimeout: 30000, // 30 seconds for hooks
    isolate: false, // Disable test isolation to speed up suite
    threads: false, // Disable threading to avoid hanging
    bail: 1, // Stop on first test failure
  },
});
