import type { APIRoute, GetStaticPaths } from "astro";
import { components, type ComponentDoc } from "../../../data/components";

// A plain markdown twin of every component page. The HTML page is mostly a live
// demo, which is noise to anything that is reading rather than looking, so an
// agent fetching docs gets this instead: the same prose, the same example, and
// the props table as a table rather than as a React island.
export const getStaticPaths: GetStaticPaths = () =>
  components.map((c) => ({ params: { slug: c.slug }, props: { doc: c } }));

const sources = import.meta.glob("../../../components/demos/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const cell = (text: string) => text.replaceAll("|", "\\|");

export const GET: APIRoute = ({ props, site }) => {
  const doc = props.doc as ComponentDoc;
  const base = site ? site.href.replace(/\/$/, "") : "";
  // Imports are shown the way they look in the user's project after `add`.
  const example = (sources[`../../../components/demos/${doc.slug}.tsx`] ?? "").replaceAll("@mitame/", "@/components/mitame/").trim();

  const body = `# ${doc.name}

${doc.description} Built on \`${doc.native}\`.

## Install

\`\`\`bash
npx @lazizbekio/mitame add ${doc.add}
\`\`\`

This copies the source into your project. There is no package to import from and no runtime dependency to add. The CSS has to be imported once for any of it to look like anything:

\`\`\`css
@import "./components/mitame/themes/base.css";
@import "./components/mitame/themes/y2k/aqua.css";
\`\`\`

Then set the theme on a root element: \`<html data-theme="aqua">\`.

## Usage

\`\`\`tsx
${example}
\`\`\`

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
${doc.props.map((p) => `| \`${cell(p.name)}\` | \`${cell(p.type)}\` | ${p.default ? `\`${cell(p.default)}\`` : ""} | ${cell(p.description)} |`).join("\n")}
${
  doc.keyboard?.length
    ? `
## Keyboard

| Key | Does |
| --- | --- |
${doc.keyboard.map(([key, does]) => `| ${cell(key)} | ${cell(does)} |`).join("\n")}
`
    : ""
}${
    doc.notes?.length
      ? `
## Notes

${doc.notes.map((n) => `- ${n}`).join("\n")}
`
      : ""
  }
## Styling

Every part carries a \`data-slot\`, and stateful parts carry \`data-state\`, \`data-variant\` or \`data-size\`. Style through those, or through the \`--mi-*\` custom properties. mitame's CSS sits in \`@layer components\`, so your own classes and Tailwind utilities already win. Do not add \`tailwind-merge\`.

---

[${doc.name} with its live demo](${base}/docs/components/${doc.slug}) · [All components](${base}/docs/components) · [llms.txt](${base}/llms.txt)
`;
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
};
