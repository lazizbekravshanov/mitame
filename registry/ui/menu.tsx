import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { useAnchorPosition, type Placement } from "../hooks/use-anchor-position";
import { useListNavigation } from "../hooks/use-list-navigation";
import { useMounted } from "../hooks/use-mounted";
import { usePopover } from "../hooks/use-popover";
import { cn } from "../lib/cn";
import { pointerFocus } from "../lib/pointer-focus";

interface MenuContext {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** A parent owns `open`, so the browser has to ask before it shows the menu. */
  controlled: boolean;
  id: string;
  trigger: RefObject<HTMLButtonElement | null>;
}
const Ctx = createContext<MenuContext | null>(null);
const useMenu = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Menu parts must be inside <Menu>");
  return ctx;
};

export interface MenuProps {
  /**
   * Controlled open state. Opening waits for your answer, closing does not:
   * light dismiss and Escape belong to the browser and cannot be canceled.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** Dropdown menu root. Pair with <MenuTrigger> and <MenuContent>. */
export function Menu({ open: controlled, onOpenChange, children }: MenuProps) {
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

export function MenuTrigger({ className, onKeyDown, ...props }: HTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen, id, trigger } = useMenu();
  const mounted = useMounted();
  return (
    <button
      ref={trigger}
      type="button"
      popoverTarget={mounted ? id : undefined}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={id}
      data-slot="menu-trigger"
      data-variant="secondary"
      data-size="md"
      className={cn("mi-button", className)}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          setOpen(true);
        }
      }}
      {...props}
    />
  );
}

export interface MenuContentProps extends Omit<HTMLAttributes<HTMLDivElement>, "id"> {
  placement?: Placement;
}

export function MenuContent({ placement = "bottom-start", className, onKeyDown, ...props }: MenuContentProps) {
  const { open, setOpen, controlled, id, trigger } = useMenu();
  const ref = useRef<HTMLDivElement>(null);
  const nav = useListNavigation(ref, { itemSelector: '[role="menuitem"]', typeahead: true });
  usePopover(ref, open, (next) => {
    setOpen(next);
    if (next) requestAnimationFrame(nav.focusFirst);
  });
  useAnchorPosition(trigger, ref, open, placement);
  const openRef = useRef(open);
  openRef.current = open;
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;

  // The trigger's native invoker shows the menu before React hears the click, so a
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
      role="menu"
      tabIndex={-1}
      data-slot="menu-content"
      data-mi-floating=""
      data-state={open ? "open" : "closed"}
      className={className}
      {...props}
      /* The trigger's popovertarget points at this id, so a caller cannot rename it. */
      id={id}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        if (e.key === "Tab") setOpen(false);
        else nav.onKeyDown(e);
      }}
    />
  );
}

export interface MenuItemProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  onSelect?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  variant?: "default" | "danger";
}

export function MenuItem({ onSelect, disabled, icon, variant = "default", className, children, onClick, onKeyDown, ...props }: MenuItemProps) {
  const { setOpen, trigger } = useMenu();
  const activate = () => {
    if (disabled) return;
    onSelect?.();
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      data-slot="menu-item"
      data-variant={variant}
      className={className}
      {...pointerFocus}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) activate();
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
    >
      {icon && <span data-slot="menu-item-icon">{icon}</span>}
      <span data-slot="menu-item-label">{children}</span>
    </div>
  );
}

export function MenuSeparator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" data-slot="menu-separator" className={className} {...props} />;
}

export function MenuLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="presentation" data-slot="menu-label" className={className} {...props} />;
}
