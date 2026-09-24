import { createContext, useContext, useId, useRef, useState, type HTMLAttributes, type RefObject } from "react";
import { useAnchorPosition, type Placement } from "../hooks/use-anchor-position";
import { usePopover } from "../hooks/use-popover";
import { cn } from "../lib/cn";

interface PopoverContext {
  open: boolean;
  setOpen: (open: boolean) => void;
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
  return <Ctx.Provider value={{ open, setOpen, id, trigger }}>{children}</Ctx.Provider>;
}

export function PopoverTrigger({ className, ...props }: HTMLAttributes<HTMLButtonElement>) {
  const { open, id, trigger } = usePopoverCtx();
  return (
    <button
      ref={trigger}
      type="button"
      popoverTarget={id}
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

export interface PopoverContentProps extends HTMLAttributes<HTMLDivElement> {
  placement?: Placement;
}

/** Lives in the top layer; the browser closes it on outside click and Escape. */
export function PopoverContent({ placement = "bottom", className, ...props }: PopoverContentProps) {
  const { open, setOpen, id, trigger } = usePopoverCtx();
  const ref = useRef<HTMLDivElement>(null);
  usePopover(ref, open, setOpen);
  useAnchorPosition(trigger, ref, open, placement);
  return (
    <div
      ref={ref}
      id={id}
      popover="auto"
      role="dialog"
      data-slot="popover-content"
      data-mi-floating=""
      data-state={open ? "open" : "closed"}
      className={className}
      {...props}
    />
  );
}
