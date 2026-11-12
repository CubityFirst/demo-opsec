import { applyD1Migrations, env } from "cloudflare:test";

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: { name: string; queries: string[] }[];
      // Secret in deployments (not declared in cloudflare.config.ts); vitest.config.ts provides it.
      SESSION_SECRET: string;
    }
  }
}

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
