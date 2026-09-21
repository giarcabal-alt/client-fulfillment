import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// vitest has no build step of its own that reads tsconfig's "paths" —
// needed the moment a test (or anything it imports) uses the "@/..."
// alias for the first time (resume-parse-core.ts imports "@/lib/config").
// Mirrors tsconfig.json's `"@/*": ["./src/*"]` exactly.
const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
});
