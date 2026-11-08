import type { APIRoute, GetStaticPaths } from "astro";
import { components, type ComponentDoc } from "../../../data/components";
import { componentMarkdown } from "../../../lib/docs-md";

// A plain markdown twin of every component page. The HTML page is mostly a live
// demo, which is noise to anything that is reading rather than looking, so an
// agent fetching docs gets this instead: the same prose, the same example, and
// the props table as a table rather than as a React island. The body lives in
// lib/docs-md.ts, shared with the copy the npm package ships.
export const getStaticPaths: GetStaticPaths = () =>
  components.map((c) => ({ params: { slug: c.slug }, props: { doc: c } }));

const sources = import.meta.glob("../../../components/demos/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const GET: APIRoute = ({ props, site }) => {
  const doc = props.doc as ComponentDoc;
  const base = site ? site.href.replace(/\/$/, "") : "";
  // Imports are shown the way they look in the user's project after `add`.
  const example = (sources[`../../../components/demos/${doc.slug}.tsx`] ?? "").replaceAll("@mitame/", "@/components/mitame/").trim();
  const body = componentMarkdown(doc, example, {
    demo: `${base}/docs/components/${doc.slug}`,
    all: `${base}/docs/components`,
    index: `${base}/llms.txt`,
  });
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
};
