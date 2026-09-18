import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const crawlerRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: crawlerRoot,
  resolve: {
    alias: {
      "@": path.resolve(crawlerRoot, ".."),
      "@crm": path.resolve(crawlerRoot, "../lib"),
    },
  },
  test: {
    root: crawlerRoot,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    exclude: [
      "../**/*",
      "**/node_modules/**",
      "**/dist/**",
      "../lib/**",
    ],
    environment: "node",
  },
});
