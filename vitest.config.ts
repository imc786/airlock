import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests only; Playwright e2e is separate (see playwright.config.ts).
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
