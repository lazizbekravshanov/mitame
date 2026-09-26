import type { Ref, RefCallback } from "react";

/** Point several refs (callback or object) at the same node. */
export function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): RefCallback<T> {
  return (node) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") return ref(node);
      if (ref) (ref as { current: T | null }).current = node;
    });
    // React 19 stops passing null to a ref that returned a cleanup, so detach
    // each ref the way it asked for: its own cleanup, or null if it gave none.
    return () => {
      refs.forEach((ref, i) => {
        const cleanup = cleanups[i];
        if (typeof cleanup === "function") cleanup();
        else if (typeof ref === "function") ref(null);
        else if (ref) (ref as { current: T | null }).current = null;
      });
    };
  };
}
