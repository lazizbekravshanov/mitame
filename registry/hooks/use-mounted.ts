import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False during server rendering and the first client render, true after mount.
 * Triggers use it to withhold `popoverTarget` until React can position the
 * popover, otherwise a click before hydration opens it in the page corner.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
