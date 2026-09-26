import { createContext, useContext, useEffect, useId, useRef, useState, type HTMLAttributes, type RefObject } from "react";
import { useAnchorPosition, type Placement } from "../hooks/use-anchor-position";
import { useMounted } from "../hooks/use-mounted";
import { usePopover } from "../hooks/use-popover";
import { cn } from "../lib/cn";

interface PopoverContext {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** A parent owns `open`, so the browser has to ask before it shows the popover. */
  controlled: boolean;
  id: string;
  trigger: RefObject<HTMLButtonElement | null>;
}
const Ctx = createContext<PopoverContext | null>(null);
const usePopoverCtx = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Popover parts must be inside <Popover>");
  return ctx;
};

export interface PopoverProps {
  /**
   * Controlled open state. Opening waits for your answer, closing does not:
   * light dismiss and Escape belong to the browser and cannot be canceled.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Popover({ open: controlled, onOpenChange, children }: PopoverProps) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = (next: boolean) => {
    if (next === open) return;
    if (controlled === undefined) setInner(next);
    onOpenChange?.(next);
  };
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  return <Ctx.Provider value={{ open, setOpen, controlled: controlled !== undefined, id, trigger }}>{children}</Ctx.Provider>;
}

export function PopoverTrigger({ className, ...props }: HTMLAttributes<HTMLButtonElement>) {
  const { open, id, trigger } = usePopoverCtx();
  const mounted = useMounted();
  return (
    <button
      ref={trigger}
      type="button"
      popoverTarget={mounted ? id : undefined}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={id}
      data-slot="popover-trigger"
      className={cn("mi-button", className)}
      data-variant="secondary"
      data-size="md"
      {...props}
    />
  );
}

export interface PopoverContentProps extends Omit<HTMLAttributes<HTMLDivElement>, "id"> {
  placement?: Placement;
}

/** Lives in the top layer; the browser closes it on outside click and Escape. */
export function PopoverContent({ placement = "bottom", className, ...props }: PopoverContentProps) {
  const { open, setOpen, controlled, id, trigger } = usePopoverCtx();
  const ref = useRef<HTMLDivElement>(null);
  usePopover(ref, open, setOpen);
  useAnchorPosition(trigger, ref, open, placement);
  const openRef = useRef(open);
  openRef.current = open;
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;

  // The trigger's native invoker shows the popover before React hears the click, so a
  // parent that owns `open` would never get to refuse. `beforetoggle` is cancelable
  // while showing, so report the click and let the parent's answer open it instead.
  useEffect(() => {
    const el = ref.current;
    if (!el || !controlled) return;
    const ask = (e: ToggleEvent) => {
      if (e.newState !== "open" || openRef.current) return;
      e.preventDefault();
      setOpenRef.current(true);
    };
    el.addEventListener("beforetoggle", ask);
    return () => el.removeEventListener("beforetoggle", ask);
  }, [controlled]);

  return (
    <div
      ref={ref}
      popover="auto"
      role="dialog"
      data-slot="popover-content"
      data-mi-floating=""
      data-state={open ? "open" : "closed"}
      className={className}
      {...props}
      /* The trigger's popovertarget points at this id, so a caller cannot rename it. */
      id={id}
    />
  );
}
