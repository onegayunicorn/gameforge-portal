import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "apps/game-web",
  resolve: {
    alias: {
      "@monolith/core-runtime": resolve(__dirname, "packages/core-runtime/src"),
      "@monolith/game-state": resolve(__dirname, "packages/game-state/src"),
      "@monolith/renderer": resolve(__dirname, "packages/renderer/src"),
    },
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: resolve(__dirname, "apps/game-web/index.html"),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
