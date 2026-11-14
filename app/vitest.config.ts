import { defineConfig } from "vitest/config";

// Unit and regression tests of the computations (no UI). Run with `npm test` (from app/).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
