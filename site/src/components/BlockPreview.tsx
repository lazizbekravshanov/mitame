import type { ComponentType } from "react";
import Dashboard from "@mitame/blocks/dashboard";
import Pricing from "@mitame/blocks/pricing";
import SignIn from "@mitame/blocks/sign-in";

const BLOCKS: Record<string, ComponentType> = {
  "sign-in": SignIn,
  pricing: Pricing,
  dashboard: Dashboard,
};

/** One island that renders a block by slug, so Astro can hydrate it statically. */
export default function BlockPreview({ slug }: { slug: string }) {
  const Block = BLOCKS[slug];
  return Block ? <Block /> : null;
}
