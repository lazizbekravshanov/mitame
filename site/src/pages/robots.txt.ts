import type { APIRoute } from "astro";

// Sitemap line only appears once SITE_URL is set (see astro.config.mjs).
export const GET: APIRoute = ({ site }) =>
  new Response(
    `User-agent: *
Allow: /
${site ? `\nSitemap: ${new URL("sitemap-index.xml", site).href}\n` : ""}`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
