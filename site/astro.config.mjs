// @ts-check
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

// Set SITE_URL (e.g. https://mitame.dev) once the domain exists; canonical links and the sitemap use it.
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  site,
  integrations: [react(), ...(site ? [sitemap()] : [])],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: { "@mitame": fileURLToPath(new URL("../registry", import.meta.url)) },
    },
  },
});
