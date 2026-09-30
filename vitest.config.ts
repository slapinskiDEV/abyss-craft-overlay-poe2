import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'node', include: ['tests/**/*.test.ts'], exclude: ['tests/renderer/**'], environment: 'node' } },
      { esbuild: { jsx: 'automatic' }, test: { name: 'renderer', include: ['tests/renderer/**/*.test.{ts,tsx}'], environment: 'jsdom', testTimeout: 20000 } },
    ],
  },
});
