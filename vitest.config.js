import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Same automatic JSX runtime the app gets from @vitejs/plugin-react, so
  // template files that never import React render in tests.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}', 'netlify/functions/**/*.test.js', 'tests/**/*.test.js'],
    globals: false,
  },
});
