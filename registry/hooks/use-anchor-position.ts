import { useLayoutEffect, type RefObject } from "react";

export type Side = "top" | "bottom" | "left" | "right";
export type Align = "start" | "center" | "end";
export type Placement = Side | `${Side}-${Exclude<Align, "center">}`;

const GAP = 6;
const MARGIN = 8;

const opposite: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

/** Pure placement math, exported for tests. */
export function computePosition(
  a: DOMRect,
  f: { width: number; height: number },
  placement: Placement,
  viewport: { width: number; height: number },
): { x: number; y: number; side: Side } {
  const [wanted, align = "center"] = placement.split("-") as [Side, Align?];
  const fits = (side: Side) =>
    side === "bottom" ? a.bottom + GAP + f.height <= viewport.height - MARGIN
    : side === "top" ? a.top - GAP - f.height >= MARGIN
    : side === "right" ? a.right + GAP + f.width <= viewport.width - MARGIN
    : a.left - GAP - f.width >= MARGIN;
  const side = fits(wanted) || !fits(opposite[wanted]) ? wanted : opposite[wanted];

  let x: number;
  let y: number;
  if (side === "top" || side === "bottom") {
    y = side === "bottom" ? a.bottom + GAP : a.top - GAP - f.height;
    x = align === "start" ? a.left : align === "end" ? a.right - f.width : a.left + a.width / 2 - f.width / 2;
  } else {
    x = side === "right" ? a.right + GAP : a.left - GAP - f.width;
    y = align === "start" ? a.top : align === "end" ? a.bottom - f.height : a.top + a.height / 2 - f.height / 2;
  }
  // MARGIN comes last so an element taller or wider than the viewport pins to the
  // top left edge instead of past it, where the user could never scroll to it.
  x = Math.max(Math.min(x, viewport.width - f.width - MARGIN), MARGIN);
  y = Math.max(Math.min(y, viewport.height - f.height - MARGIN), MARGIN);
  return { x, y, side };
}

/**
 * Positions a floating element (a popover in the top layer, so `position: fixed`)
 * next to an anchor element. Flips to the other side when there is no
 * room and shifts to stay inside the viewport. `matchWidth` sets a min-width
 * equal to the anchor (used by Select).
 */
export function useAnchorPosition(
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  open: boolean,
  placement: Placement = "bottom-start",
  matchWidth = false,
) {
  useLayoutEffect(() => {
    const el = floating.current;
    if (!open || !el) return;
    const update = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      if (matchWidth) el.style.minWidth = `${a.width}px`;
      const f = el.getBoundingClientRect();
      const pos = computePosition(a, f, placement, { width: window.innerWidth, height: window.innerHeight });
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      el.dataset.side = pos.side;
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, floating, open, placement, matchWidth]);
}
