export interface Prop {
  name: string;
  type: string;
  default?: string;
  description: string;
}

export interface ComponentDoc {
  slug: string;
  name: string;
  description: string;
  /** What `npx @lazizbekio/mitame add` takes. */
  add: string;
  /** Built on this platform feature. */
  native: string;
  props: Prop[];
  keyboard?: [string, string][];
  notes?: string[];
}

export const components: ComponentDoc[] = [
  {
    slug: "button",
    name: "Button",
    description: "The gel pill, the glass pill and everything in between.",
    add: "button",
    native: "<button>",
    props: [
      { name: "variant", type: '"primary" | "secondary" | "ghost" | "danger"', default: '"secondary"', description: "Visual weight." },
      { name: "size", type: '"sm" | "md" | "lg"', default: '"md"', description: "Height and padding. Touch screens always get a 44px tap area." },
      { name: "type", type: '"button" | "submit" | "reset"', default: '"button"', description: "Defaults to button so it never submits a form by accident." },
      { name: "...props", type: "ButtonHTMLAttributes", description: "Anything a <button> takes." },
    ],
  },
  {
    slug: "card",
    name: "Card",
    description: "The surface everything sits on: pinstripes in Aqua, liquid glass in Now.",
    add: "card",
    native: "<div>",
    props: [
      { name: "Card", type: "HTMLAttributes<div>", description: "The surface." },
      { name: "CardHeader / CardBody / CardFooter", type: "HTMLAttributes<div>", description: "Layout slots." },
      { name: "CardTitle", type: "HTMLAttributes<h3>", description: "Heading." },
      { name: "CardDescription", type: "HTMLAttributes<p>", description: "Muted supporting text." },
    ],
  },
  {
    slug: "text-field",
    name: "TextField",
    description: "Label, hint and error wired together for screen readers.",
    add: "text-field",
    native: "<input>",
    props: [
      { name: "label", type: "ReactNode", description: "Visible label, linked with htmlFor." },
      { name: "description", type: "ReactNode", description: "Hint under the field, linked with aria-describedby." },
      { name: "error", type: "ReactNode", description: "Error message. Also sets aria-invalid." },
      { name: "icon", type: "ReactNode", description: "Leading icon, e.g. <SearchIcon />." },
      { name: "...props", type: "InputHTMLAttributes", description: "Anything an <input> takes." },
    ],
    notes: ["On touch screens the text is 16px so iOS Safari does not zoom in on focus."],
  },
  {
    slug: "checkbox",
    name: "Checkbox",
    description: "A real checkbox with a custom box, including the indeterminate dash.",
    add: "checkbox",
    native: '<input type="checkbox">',
    props: [
      { name: "indeterminate", type: "boolean", default: "false", description: "Shows a dash. The browser clears it on the next click." },
      { name: "children", type: "ReactNode", description: "The label." },
      { name: "...props", type: "InputHTMLAttributes", description: "checked, defaultChecked, onChange, name, disabled…" },
    ],
    keyboard: [["Space", "Toggle"]],
  },
  {
    slug: "switch",
    name: "Switch",
    description: "An on/off toggle. A native checkbox with role switch.",
    add: "switch",
    native: '<input type="checkbox" role="switch">',
    props: [
      { name: "children", type: "ReactNode", description: "The label." },
      { name: "...props", type: "InputHTMLAttributes", description: "checked, defaultChecked, onChange, name, disabled…" },
    ],
    keyboard: [["Space", "Toggle"]],
  },
  {
    slug: "slider",
    name: "Slider",
    description: "A native range input with a filled track.",
    add: "slider",
    native: '<input type="range">',
    props: [
      { name: "value / defaultValue", type: "number", description: "Controlled or uncontrolled value." },
      { name: "onValueChange", type: "(value: number) => void", description: "Called with the new number." },
      { name: "min / max / step", type: "number", default: "0 / 100 / 1", description: "Range." },
    ],
    keyboard: [["← → ↑ ↓", "Step"], ["Home / End", "Min / max"], ["Page Up / Down", "Big step"]],
  },
  {
    slug: "select",
    name: "Select",
    description: "The popup button. Opens a listbox in the top layer, works in forms.",
    add: "select",
    native: "popover + listbox",
    props: [
      { name: "options", type: "{ value, label, disabled? }[]", description: "The choices." },
      { name: "value / defaultValue", type: "string", description: "Controlled or uncontrolled value." },
      { name: "onValueChange", type: "(value: string) => void", description: "Called when a choice is made." },
      { name: "placeholder", type: "ReactNode", default: '"Select…"', description: "Shown when nothing is selected." },
      { name: "name", type: "string", description: "Adds a hidden input so the value is sent with forms." },
      { name: "aria-label / aria-labelledby", type: "string", description: "Give it a name." },
    ],
    keyboard: [["↓ / ↑ on the button", "Open"], ["↓ ↑ Home End", "Move"], ["Type letters", "Jump to a match"], ["Enter / Space", "Choose"], ["Esc", "Close"]],
  },
  {
    slug: "tabs",
    name: "Tabs",
    description: "A segmented control that switches panels.",
    add: "tabs",
    native: "tablist / tab / tabpanel",
    props: [
      { name: "Tabs value / defaultValue", type: "string", description: "The active tab." },
      { name: "Tabs onValueChange", type: "(value: string) => void", description: "Called when the tab changes." },
      { name: "TabsTrigger value", type: "string", description: "Which panel it opens." },
      { name: "TabsPanel value", type: "string", description: "Shown when its value is active." },
    ],
    keyboard: [["← →", "Move and activate"], ["Home / End", "First / last"]],
  },
  {
    slug: "menu",
    name: "Menu",
    description: "A dropdown of actions.",
    add: "menu",
    native: "popover + menu",
    props: [
      { name: "Menu open / onOpenChange", type: "boolean / (open) => void", description: "Optional control." },
      { name: "MenuContent placement", type: "Placement", default: '"bottom-start"', description: "Flips when there is no room." },
      { name: "MenuItem onSelect", type: "() => void", description: "Runs, then the menu closes." },
      { name: "MenuItem disabled / variant / icon", type: 'boolean / "default" | "danger" / ReactNode', description: "Item options." },
      { name: "MenuSeparator / MenuLabel", type: "HTMLAttributes<div>", description: "Grouping." },
    ],
    keyboard: [["↓ / ↑ on the button", "Open"], ["↓ ↑ Home End", "Move"], ["Type letters", "Jump"], ["Enter / Space", "Run"], ["Esc", "Close"]],
  },
  {
    slug: "dialog",
    name: "Dialog",
    description: "A modal on the native <dialog>: focus trap, Escape and inert page for free.",
    add: "dialog",
    native: "<dialog> showModal()",
    props: [
      { name: "Dialog open / defaultOpen / onOpenChange", type: "boolean / (open) => void", description: "Control it or let it manage itself." },
      { name: "DialogContent dismissible", type: "boolean", default: "true", description: "Close on backdrop click." },
      { name: "DialogContent showClose", type: "boolean", default: "true", description: "Show the close button in the corner." },
      { name: "DialogTitle / DialogDescription", type: "HTMLAttributes", description: "Wired to aria-labelledby and aria-describedby." },
      { name: "DialogClose", type: "HTMLAttributes<button>", description: "Any button that closes it." },
    ],
    keyboard: [["Esc", "Close"], ["Tab", "Stays inside the dialog"]],
    notes: ["The page behind stops scrolling while a dialog is open."],
  },
  {
    slug: "popover",
    name: "Popover",
    description: "Floating content next to a button. The browser handles outside clicks and Escape.",
    add: "popover",
    native: "popover API",
    props: [
      { name: "Popover open / onOpenChange", type: "boolean / (open) => void", description: "Optional control." },
      { name: "PopoverContent placement", type: "Placement", default: '"bottom"', description: "Flips and shifts to stay on screen." },
    ],
    keyboard: [["Enter / Space on the button", "Toggle"], ["Esc", "Close"]],
  },
  {
    slug: "tooltip",
    name: "Tooltip",
    description: "A short hint. Hover with a mouse, focus with a keyboard, long press on touch.",
    add: "tooltip",
    native: "popover (manual)",
    props: [
      { name: "content", type: "ReactNode", description: "The hint." },
      { name: "children", type: "ReactElement", description: "One focusable element, like a Button." },
      { name: "placement", type: "Placement", default: '"top"', description: "Where it appears." },
      { name: "delay", type: "number", default: "400", description: "Milliseconds before showing on hover." },
    ],
    keyboard: [["Tab to the element", "Show"], ["Esc", "Hide"]],
    notes: ["Never put information only in a tooltip; touch users have to go looking for it."],
  },
  {
    slug: "toast",
    name: "Toast",
    description: "Notifications from anywhere with toast(), announced to screen readers.",
    add: "toast",
    native: "popover (manual) + aria-live",
    props: [
      { name: "toast(title | options)", type: "string | ToastOptions", description: "Shows a toast, returns its id." },
      { name: "toast.success / error / warning", type: "(title, options?) => id", description: "Shortcuts for variants." },
      { name: "toast.dismiss(id?)", type: "(id?: number) => void", description: "Close one, or all." },
      { name: "options.duration", type: "number", default: "4000", description: "Use Infinity to keep it until closed." },
      { name: "options.action", type: "{ label, onClick }", description: "One button, like Undo." },
      { name: "Toaster position", type: '"top-left" … "bottom-right"', default: '"bottom-right"', description: "Render <Toaster /> once near the root." },
    ],
    notes: ["Hovering pauses the timer. On phones toasts span the screen."],
  },
];

export const bySlug = Object.fromEntries(components.map((c) => [c.slug, c]));
