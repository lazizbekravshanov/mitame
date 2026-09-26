import type { ComponentType } from "react";
import Dashboard from "@mitame/blocks/dashboard";
import DataTable from "@mitame/blocks/data-table";
import EmptyStates from "@mitame/blocks/empty-states";
import Landing from "@mitame/blocks/landing";
import Pricing from "@mitame/blocks/pricing";
import Settings from "@mitame/blocks/settings";
import SignIn from "@mitame/blocks/sign-in";

const BLOCKS: Record<string, ComponentType> = {
  "sign-in": SignIn,
  pricing: Pricing,
  settings: Settings,
  "data-table": DataTable,
  landing: Landing,
  "empty-states": EmptyStates,
  dashboard: Dashboard,
};

/** One island that renders a block by slug, so Astro can hydrate it statically. */
export default function BlockPreview({ slug }: { slug: string }) {
  const Block = BLOCKS[slug];
  return Block ? <Block /> : null;
}
