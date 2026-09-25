// One source of truth for the site's theme + mode, shared by every island.
// The <head> script in Base.astro applies the saved values before first paint.
import { useEffect, useState } from "react";

export const THEMES = [
  { id: "platinum", group: "Eras", era: "Vintage", year: "1997", ready: true },
  { id: "aqua", group: "Eras", era: "Y2K", year: "2001", ready: true },
  { id: "liquid", group: "Eras", era: "Now", year: "2026", ready: true },
  { id: "brutalist", group: "Styles", era: "Brutalist", year: "loud", ready: true },
  { id: "minimal", group: "Styles", era: "Minimal", year: "quiet", ready: true },
  { id: "urban", group: "Styles", era: "Urban", year: "night", ready: true },
] as const;
export const ERAS = THEMES.filter((t) => t.group === "Eras");
export const STYLES = THEMES.filter((t) => t.group === "Styles");
export type Theme = (typeof THEMES)[number];
export type ThemeId = Theme["id"];
export type Mode = "system" | "light" | "dark";

const EVENT = "mitame:theme";

function read(): { theme: ThemeId; mode: Mode } {
  const el = document.documentElement;
  return {
    theme: (el.dataset.theme as ThemeId) ?? "aqua",
    mode: (el.dataset.mode as Mode | undefined) ?? "system",
  };
}

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private mode or blocked storage: the choice just won't persist
  }
}

export function setTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  store("mitame-theme", theme);
  window.dispatchEvent(new Event(EVENT));
}

export function setMode(mode: Mode) {
  const el = document.documentElement;
  if (mode === "system") delete el.dataset.mode;
  else el.dataset.mode = mode;
  store("mitame-mode", mode === "system" ? null : mode);
  window.dispatchEvent(new Event(EVENT));
}

/**
 * The server renders SSR_DEFAULT and so does the first client render, so
 * hydration matches exactly. React 19 does not patch attribute mismatches, so
 * reading the saved theme during hydration would leave a stale selection in
 * the DOM. The real value lands in an effect right after mount.
 */
const SSR_DEFAULT: { theme: ThemeId; mode: Mode } = { theme: "aqua", mode: "system" };

export function useTheme() {
  const [state, setState] = useState(SSR_DEFAULT);
  useEffect(() => {
    const sync = () => setState(read());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return state;
}
