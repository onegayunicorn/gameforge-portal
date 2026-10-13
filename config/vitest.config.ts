import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  root,
  resolve: {
    alias: {
      // Games and tests import the engine by package name; resolve it to the TypeScript source
      // so no pre-build step is needed to run tests or bundle a game.
      '@gameforge/engine': `${root.replace(/\\/g, '/')}engine/src/index.ts`,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: 'default',
  },
});
