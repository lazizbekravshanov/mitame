import type { APIRoute } from "astro";
import { contrastSummary, findRoot, llmsTxt } from "../lib/docs-md";

// A plain text map of mitame for AI coding tools (https://llmstxt.org). The
// body lives in lib/docs-md.ts, shared with the copy the npm package ships,
// and the contrast numbers are measured by the checker at build time.
export const GET: APIRoute = ({ site }) => {
  const base = site ? site.href.replace(/\/$/, "") : "";
  const body = llmsTxt({
    base,
    componentDoc: (slug) => `${base}/docs/components/${slug}.md`,
    contrast: contrastSummary(findRoot(process.cwd())),
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
