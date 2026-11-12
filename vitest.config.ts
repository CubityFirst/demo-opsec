import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import cloudflareConfig from "./cloudflare.config.ts";

// @cloudflare/vitest-pool-workers cannot read cloudflare.config.ts yet (only Wrangler config
// files), so the test Worker is described directly from it: same entrypoint, compat date and
// flags, and local D1/R2 for each binding of those types.
async function workerFromCloudflareConfig() {
  const config = await cloudflareConfig({ mode: "test", isPreview: false });
  const worker = config.worker;
  const env = Object.entries(worker.env) as [string, { type?: string } | false | undefined][];
  const namesOfType = (type: string) => env.filter(([, b]) => b && b.type === type).map(([name]) => name);
  return {
    main: worker.entrypoint,
    compatibilityDate: worker.compatibilityDate,
    compatibilityFlags: worker.compatibilityFlags,
    d1Databases: namesOfType("d1"),
    r2Buckets: namesOfType("r2"),
  };
}

export default defineConfig(async () => {
  const migrations = await readD1Migrations(fileURLToPath(new URL("./drizzle", import.meta.url)));
  const { main, ...worker } = await workerFromCloudflareConfig();
  return {
    resolve: {
      alias: {
        "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
      },
    },
    plugins: [
      cloudflareTest({
        main,
        miniflare: {
          ...worker,
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENVIRONMENT: "test",
            SESSION_SECRET: "test-session-secret",
            OIDC_ISSUER: "https://auth.cubityfir.st",
            OIDC_CLIENT_ID: "test-client",
            OIDC_CLIENT_SECRET: "test-secret",
            AUTH_MODE: "oidc",
            AUTH_PROVIDER_LABEL: "Test IdP",
            ACCESS_ALLOWED_EMAILS: "allowed@example.com, Also.Allowed@Example.com",
            AI_BASE_URL: "https://ai.test/v1",
            AI_MODEL: "test-model",
            AI_LABEL: "test",
            AI_API_KEY: "none",
            AI_EXTRA_HEADERS: '{"x-test-header":"yes"}',
            AI_EXTRA_BODY: '{"parallel_tool_calls":true}',
            ASK_FAKE_UPSTREAM: "1",
          },
          // The real Annex Worker is not available in tests; nothing here performs a login.
          serviceBindings: { ANNEX: async () => new Response("annex unavailable in tests", { status: 503 }) },
        },
      }),
    ],
    test: {
      include: ["test/**/*.test.ts"],
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
