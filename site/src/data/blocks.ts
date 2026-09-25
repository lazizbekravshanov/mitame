export interface BlockDoc {
  slug: string;
  name: string;
  description: string;
  /** Components it is built from, for the docs page. */
  uses: string[];
  /** Rough preview height so the page does not jump while islands load. */
  height: number;
}

export const blocks: BlockDoc[] = [
  {
    slug: "sign-in",
    name: "Sign in",
    description: "A centered sign in card with email, password, remember me and a magic link fallback.",
    uses: ["Card", "TextField", "Checkbox", "Button"],
    height: 620,
  },
  {
    slug: "pricing",
    name: "Pricing",
    description: "Three plans with a monthly and yearly switch, a featured tier and feature lists.",
    uses: ["Card", "Switch", "Button"],
    height: 720,
  },
  {
    slug: "dashboard",
    name: "Dashboard",
    description: "Sidebar, search and range filters, stat tiles and a table with share bars.",
    uses: ["Card", "TextField", "Select", "Menu", "Tabs", "Button"],
    height: 760,
  },
];

export const blockBySlug = Object.fromEntries(blocks.map((b) => [b.slug, b]));
