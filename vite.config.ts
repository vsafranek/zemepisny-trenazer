import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { target: 'es2022' }, // top-level await in src/data.ts
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
