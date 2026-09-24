// One source of truth for the site's theme + mode, shared by every island.
// The <head> script in Base.astro applies the saved values before first paint.
import { useSyncExternalStore } from "react";

export const THEMES = [
  { id: "aqua", era: "Y2K", year: "2001", ready: true },
  { id: "liquid", era: "Now", year: "2026", ready: true },
  { id: "platinum", era: "Vintage", year: "1984", ready: false },
  { id: "blend", era: "Remix", year: "any", ready: false },
] as const;
export type ThemeId = "aqua" | "liquid";
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

let cache = { theme: "aqua" as ThemeId, mode: "system" as Mode };
const snapshot = () => {
  const next = read();
  if (next.theme !== cache.theme || next.mode !== cache.mode) cache = next;
  return cache;
};
const serverSnapshot = () => cache;
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

export function useTheme() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
