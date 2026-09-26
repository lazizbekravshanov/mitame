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
    slug: "settings",
    name: "Settings",
    description: "Sections down the side, grouped fields, switches with help text, and a danger zone whose confirm button waits until you type the account name.",
    uses: ["Card", "TextField", "Switch", "Select", "Tabs", "Dialog", "Button"],
    height: 820,
  },
  {
    slug: "data-table",
    name: "Data table",
    description: "Search and filters, sortable columns, row selection with a bulk action bar, and pagination over the filtered set.",
    uses: ["Card", "TextField", "Select", "Checkbox", "Menu", "Button"],
    height: 820,
  },
  {
    slug: "landing",
    name: "Landing",
    description: "Hero, feature grid, logo strip, quote, statistics and a closing call to action, with a sign up dialog on the header button.",
    uses: ["Button", "Card", "Dialog", "TextField", "Checkbox"],
    height: 900,
  },
  {
    slug: "empty-states",
    name: "Empty states",
    description: "The five states most libraries skip: nothing yet, no results, an error, offline and permission denied.",
    uses: ["Card", "Button", "TextField"],
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
