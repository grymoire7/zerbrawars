import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset URLs, so the build works from any folder on the host.
  base: "./",
  test: {
    environment: "node",
    // The balance and determinism suites run whole campaigns. They take a few seconds here and
    // more than the 5s default on a shared CI runner, so give them room.
    testTimeout: 30_000,
    // Render and app tests cover pure modules only (no three, no DOM); the UI tests are the pure helpers in src/ui.
    include: [
      "src/sim/**/*.test.ts",
      "src/render/**/*.test.ts",
      "src/app/**/*.test.ts",
      "src/theme/**/*.test.ts",
      "src/ui/**/*.test.ts",
    ],
  },
});
