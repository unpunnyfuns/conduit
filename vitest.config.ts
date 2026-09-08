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
    ],
  },
});
