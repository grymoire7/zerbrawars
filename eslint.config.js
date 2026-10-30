import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "docs", "tmp", ".worktrees"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // The sim must stay pure and runnable in Node: no three.js, no render/ui/app code.
    files: ["src/sim/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["three", "three/*"],
              message: "src/sim must not import three.js.",
            },
            {
              group: [
                "**/render",
                "**/render/*",
                "**/ui",
                "**/ui/*",
                "**/app",
                "**/app/*",
              ],
              message:
                "src/sim must not import from src/render, src/ui or src/app.",
            },
          ],
        },
      ],
    },
  },
);
