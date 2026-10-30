import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Render and app tests cover pure modules only (no three, no DOM).
    include: [
      "src/sim/**/*.test.ts",
      "src/render/**/*.test.ts",
      "src/app/**/*.test.ts",
    ],
  },
});
