import { defineConfig } from "vitest/config";

// Vitest covers the pure shared modules; the pipeline test runs under Deno (deno task test:backend).
export default defineConfig({ test: { include: ["supabase/functions/_shared/scoring.test.ts"] } });
