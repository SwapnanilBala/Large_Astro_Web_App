import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/__tests__/**/*.{test,spec}.{ts,tsx}", "**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", ".claude"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      /* `server-only` is a build-time guard with no runtime module to resolve,
         so importing anything that uses it — lib/db/client.ts and everything
         under lib/identity — fails collection outright. Stubbing it here is
         what makes those modules testable at all; it does not weaken the
         guard, which is enforced by the Next compiler, not by the test run. */
      "server-only": path.resolve(__dirname, "lib/__tests__/stubs/server-only.ts"),
    },
  },
});
