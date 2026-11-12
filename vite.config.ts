import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Worker config comes from cloudflare.config.ts (evaluated with the build mode, so
    // `--mode prod` selects the author's instance).
    cloudflare(),
  ],
  environments: {
    // The Worker's Vite environment. `cf deploy` uploads every source map in the build
    // output; keep the previous Wrangler behaviour of not uploading any.
    ssr: { build: { sourcemap: false } },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/web", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
});
