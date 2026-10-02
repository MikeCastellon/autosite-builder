import { defineConfig } from 'vitest/config';

// npm run theme:render: writes full published-page HTML for every template
// x fixture (scripts/theme-render.test.jsx) for screenshots. Kept out of the
// default test run because it writes files.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['scripts/theme-render.test.jsx'],
    globals: false,
    testTimeout: 120000,
  },
});
