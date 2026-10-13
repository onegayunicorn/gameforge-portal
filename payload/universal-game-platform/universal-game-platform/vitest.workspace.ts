import { defineWorkspace } from 'vitest/config';
export default defineWorkspace(['packages/*/vitest.config.ts', 'game/vitest.config.ts', 'tests/platform/vitest.config.ts']);
