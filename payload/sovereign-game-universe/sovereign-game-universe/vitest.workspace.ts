import { defineWorkspace } from 'vitest/config';
export default defineWorkspace(['platform/packages/*/vitest.config.ts', 'marketplace/**/vitest.config.ts']);
