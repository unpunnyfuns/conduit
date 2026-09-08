import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "layout",
          environment: "node",
          include: ["test/schema/**/*.test.ts", "test/layout/**/*.test.ts"],
        },
      },
      {
        plugins: [react(), tailwindcss()],
        resolve: {
          alias: {
            "@unpunnyfuns/lens": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
          },
        },
        test: {
          name: "browser",
          include: ["test/browser/**/*.test.tsx"],
          setupFiles: ["test/browser/setup.ts"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
