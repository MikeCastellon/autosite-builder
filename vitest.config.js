import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}', 'netlify/functions/**/*.test.js', 'tests/**/*.test.js'],
    globals: false,
  },
});
