import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Render tests cover pure modules only (no three, no DOM).
    include: ["src/sim/**/*.test.ts", "src/render/**/*.test.ts"],
  },
});
