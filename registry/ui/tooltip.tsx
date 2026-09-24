import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type FocusEvent,
  type PointerEvent,
  type Ref,
  type SyntheticEvent,
} from "react";
import { useAnchorPosition, type Placement } from "../hooks/use-anchor-position";
import { mergeRefs } from "../lib/refs";

export interface TooltipProps {
  content: ReactNode;
  /** A single focusable element, for example a <Button>. */
  children: ReactElement<Record<string, unknown> & { ref?: Ref<HTMLElement> }>;
  placement?: Placement;
  /** Milliseconds before showing on mouse hover. Keyboard focus shows it right away. */
  delay?: number;
}

type Handler = ((e: SyntheticEvent) => void) | undefined;

const LONG_PRESS = 500;
const TOUCH_LINGER = 1500;

/** Keyboard focus only; a tap or click that focuses a button should not pop a tooltip. */
function isFocusVisible(el: Element) {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * Mouse: shows on hover after `delay`. Keyboard: shows on focus. Touch: shows on
 * long press and hides shortly after the finger lifts. Never put information
 * only in a tooltip; touch users have to go looking for it.
 */
export function Tooltip({ content, children, placement = "top", delay = 400 }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();

  useAnchorPosition(anchor, tip, open, placement);

  useEffect(() => {
    const el = tip.current;
    if (!el) return;
    try {
      if (open) el.showPopover();
      else el.hidePopover();
    } catch {
      // already in the requested state
    }
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  /** wait >= 0: open after wait. wait = -1: touch released, close after a moment if it opened. */
  const show = (wait: number) => {
    clearTimeout(timer.current);
    if (wait === -1) {
      timer.current = setTimeout(() => setOpen(false), TOUCH_LINGER);
      return;
    }
    timer.current = setTimeout(() => setOpen(true), wait);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };
  const chain =
    <E extends SyntheticEvent>(theirs: unknown, ours: (e: E) => void) =>
    (e: E) => {
      (theirs as Handler)?.(e);
      ours(e);
    };
  const p = children.props;

  return (
    <>
      {cloneElement(children, {
        ref: mergeRefs(anchor, p.ref),
        "aria-describedby": [p["aria-describedby"], open ? id : null].filter(Boolean).join(" ") || undefined,
        onPointerEnter: chain(p.onPointerEnter, (e: PointerEvent) => e.pointerType === "mouse" && show(delay)),
        onPointerLeave: chain(p.onPointerLeave, (e: PointerEvent) => e.pointerType === "mouse" && hide()),
        onPointerDown: chain(p.onPointerDown, (e: PointerEvent) => e.pointerType !== "mouse" && show(LONG_PRESS)),
        onPointerUp: chain(p.onPointerUp, (e: PointerEvent) => e.pointerType !== "mouse" && show(-1)),
        onPointerCancel: chain(p.onPointerCancel, (e: PointerEvent) => e.pointerType !== "mouse" && hide()),
        onFocus: chain(p.onFocus, (e: FocusEvent) => isFocusVisible(e.currentTarget) && show(0)),
        onBlur: chain(p.onBlur, hide),
      })}
      <div ref={tip} id={id} role="tooltip" popover="manual" data-slot="tooltip" data-mi-floating="" data-state={open ? "open" : "closed"}>
        {content}
      </div>
    </>
  );
}
