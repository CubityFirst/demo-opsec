import { bindings, defineConfig } from "cf/config";

// Worker config for the `cf` CLI (`cf dev` / `cf build` / `cf deploy`) and the Vite plugin
// (`experimental.newConfig` in vite.config.ts). Replaces wrangler.jsonc.
//
// ---------------------------------------------------------------------------
// Default mode = the generic template used by "Deploy to Cloudflare" and by anyone
// self-hosting: a workers.dev URL and OPEN ACCESS (AUTH_MODE "open"). Add your own
// authentication before exposing an instance to the internet; see README → Deploy your own.
//
// The author's own instance is the `prod` mode below (custom domains, OIDC via a private
// provider, AI Gateway). Build/deploy it with `--mode prod` (`npm run deploy:prod`). It was
// `env.prod` in the old wrangler.jsonc.
// ---------------------------------------------------------------------------
//
// D1 migrations for `DB` live in ./drizzle (drizzle-kit output). `cf d1 migrations apply`
// takes the database ID and `--dir drizzle`; see the db:migrate:* scripts in package.json.
//
// No vars are required. Everything below is optional and defaults sensibly when unset:
//   AUTH_MODE            "open" (default: no sign-in, every visitor is the owner) or "oidc"
//   AUTH_PROVIDER_LABEL  name on the sign-in button (default "SSO")
//   oidc mode            OIDC_ISSUER, OIDC_CLIENT_ID, ACCESS_ALLOWED_EMAILS (comma-separated verified
//                        emails; accounts with the `admin` role are always allowed)
//   Ask                  AI_BASE_URL, AI_MODEL, AI_LABEL, AI_EXTRA_BODY — or configure Ask from the
//                        Account page after deploying (README → Ask). Put spend limits on the
//                        provider / AI Gateway.
//   ENVIRONMENT          "development" only in local .dev.vars (opens the /api/dev/* seed routes)
//
// Secrets (`npx wrangler secret put <NAME> --name <worker>`; existing secrets are kept across
// `cf deploy`): SESSION_SECRET (needed to encrypt stored provider keys, and for oidc mode),
// OIDC_CLIENT_SECRET (oidc mode), AI_API_KEY, AI_EXTRA_HEADERS (optional).

export default defineConfig(({ mode }) => {
  const prod = mode === "prod";

  return {
    accountId: "d843ae90cab33e54f4d284bc65d2fd6a",
    worker: {
      name: prod ? "opsec" : "demo-opsec",
      entrypoint: "src/worker/index.ts",
      // Must not exceed what the test pool's bundled workerd supports (see CLAUDE.md).
      compatibilityDate: "2026-08-22",
      compatibilityFlags: ["nodejs_compat"],
      observability: { enabled: true },
      assets: {
        notFoundHandling: "single-page-application",
        // Every request hits the Worker first (host redirects, auth); the Worker then serves
        // static files via ASSETS. The asset directory is the Vite client build.
        runWorkerFirst: true,
      },
      // prod: only the custom domains below, no workers.dev or preview hostnames for the
      // author's instance. Template: workers.dev plus Preview URLs (Wrangler enabled Preview
      // URLs whenever workers.dev was on; cf defaults them to off, so keep them explicit).
      workersDev: !prod,
      previewUrls: !prod,
      domains: prod
        ? [
            "opsec.cubityfir.st",
            "opsec.nexus",
            // Former hostname: the Worker answers with a 308 to opsec.cubityfir.st (see src/worker/index.ts).
            "nexus.cubityfir.st",
          ]
        : undefined,
      env: {
        ASSETS: bindings.assets(),
        DB: prod
          ? bindings.d1({ name: "nexus-db", id: "86818e80-503b-4c67-970a-39d6ca9ab6e0" })
          : bindings.d1({ name: "opsec-db", id: "d964b055-783c-49b4-96c7-4032f2d8374b" }),
        BUCKET: bindings.r2({ name: prod ? "nexus-files" : "demo-opsec-files" }),
        // Annex (auth.cubityfir.st) is a Worker on the same zone. A plain fetch from this Worker to a
        // same-zone hostname bypasses that hostname's Worker and hits the origin, so server-to-server
        // OIDC calls (token, JWKS, userinfo) go through this service binding. See services/oidc.ts.
        ANNEX: prod && bindings.worker({ worker: "annex-auth" }),
        ...(prod && {
          AUTH_MODE: bindings.text("oidc"),
          AUTH_PROVIDER_LABEL: bindings.text("Annex"),
          OIDC_ISSUER: bindings.text("https://auth.cubityfir.st"),
          OIDC_CLIENT_ID: bindings.text("annx_6d092a4c0a09224a32ab96d0"),
          ACCESS_ALLOWED_EMAILS: bindings.text("cubity@cubityfir.st"),
          AI_BASE_URL: bindings.text(
            "https://gateway.ai.cloudflare.com/v1/d843ae90cab33e54f4d284bc65d2fd6a/opsec/compat",
          ),
          AI_MODEL: bindings.text("openai/gpt-5.6-luna"),
          AI_LABEL: bindings.text("gpt-5.6-luna via AI Gateway"),
          AI_EXTRA_BODY: bindings.text('{"reasoning_effort":"none"}'),
        }),
      },
    },
  };
});
