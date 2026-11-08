import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { CloseIcon } from "../icons/close";
import { modalHost, subscribeModalHost } from "../lib/modal-host";
import { ErrorIcon } from "../icons/error";
import { InfoIcon } from "../icons/info";
import { SuccessIcon } from "../icons/success";
import { WarningIcon } from "../icons/warning";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  /** Milliseconds before auto dismiss. `Infinity` keeps it until closed. Default 4000. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends Required<Pick<ToastOptions, "variant" | "duration">>, Omit<ToastOptions, "variant" | "duration"> {
  id: number;
}

// A tiny module level store, so toast() works from anywhere (event handlers, effects, outside React).
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(input: ToastOptions | string): number {
  const opts = typeof input === "string" ? { title: input } : input;
  const id = nextId++;
  // A caller passing an optional prop straight through sends `undefined`, which must not wipe the defaults.
  items = [...items, { ...opts, variant: opts.variant ?? "default", duration: opts.duration ?? 4000, id }];
  emit();
  return id;
}
toast.success = (title: ReactNode, o?: Omit<ToastOptions, "title" | "variant">) => toast({ ...o, title, variant: "success" });
toast.error = (title: ReactNode, o?: Omit<ToastOptions, "title" | "variant">) => toast({ ...o, title, variant: "error" });
toast.warning = (title: ReactNode, o?: Omit<ToastOptions, "title" | "variant">) => toast({ ...o, title, variant: "warning" });
toast.dismiss = (id?: number) => {
  items = id === undefined ? [] : items.filter((t) => t.id !== id);
  emit();
};

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => items;

const icons = { default: InfoIcon, success: SuccessIcon, error: ErrorIcon, warning: WarningIcon };

export interface ToasterProps {
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
}

/** Render once near the root. Sits in the top layer so it shows above dialogs too. */
export function Toaster({ position = "bottom-right" }: ToasterProps) {
  const list = useSyncExternalStore(subscribe, snapshot, snapshot);
  // Painting above a modal dialog is not enough: everything outside the dialog's
  // subtree is inert, clicks fall through and Tab never arrives. So the region
  // moves inside the open dialog and comes home when the last one closes. The
  // popover still paints in the top layer from either place.
  const host = useSyncExternalStore(subscribeModalHost, modalHost, () => null);
  const ref = useRef<HTMLElement>(null);
  const home = useRef<HTMLDivElement>(null);
  const paused = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    const target = host ?? home.current;
    if (!el || !target || el.parentNode === target) return;
    // Moving a node closes its popover and drops focus, so put both back.
    const focused = el.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null;
    target.appendChild(el);
    try {
      if (items.length) el.showPopover();
    } catch {
      // popover API missing or already shown
    }
    focused?.focus();
  }, [host]);

  useLayoutEffect(() => {
    const el = ref.current;
    const h = home.current;
    // React tears down from home, so the region must be back there by unmount.
    return () => {
      if (el && h && el.parentNode !== h) h.appendChild(el);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Hiding the region blows away focus inside it, so a focused toast keeps its place in the top layer.
    const holdsFocus = el.contains(document.activeElement);
    try {
      // Re-show so the region stays above anything opened after it (like a dialog).
      if (el.matches(":popover-open") && !holdsFocus) el.hidePopover();
      if (list.length && !holdsFocus) el.showPopover();
    } catch {
      // popover API missing or already shown
    }
  }, [list]);

  return (
    // The wrapper never moves, so React keeps a stable anchor while the section travels.
    <div ref={home} style={{ display: "contents" }}>
      <section
        ref={ref}
        popover="manual"
        aria-label="Notifications"
        aria-live="polite"
        data-slot="toaster"
        data-position={position}
        onPointerEnter={() => (paused.current = true)}
        onPointerLeave={() => (paused.current = false)}
      >
        {list.map((t) => (
          <ToastView key={t.id} item={t} paused={paused} />
        ))}
      </section>
    </div>
  );
}

function ToastView({ item, paused }: { item: ToastItem; paused: React.RefObject<boolean> }) {
  const Icon = icons[item.variant];
  useEffect(() => {
    if (!Number.isFinite(item.duration)) return;
    let left = item.duration;
    const tick = 100;
    const timer = setInterval(() => {
      if (paused.current) return;
      left -= tick;
      if (left <= 0) toast.dismiss(item.id);
    }, tick);
    return () => clearInterval(timer);
  }, [item.id, item.duration, paused]);

  return (
    <div role="status" data-slot="toast" data-variant={item.variant}>
      <Icon data-slot="toast-icon" />
      <div data-slot="toast-text">
        <div data-slot="toast-title">{item.title}</div>
        {item.description && <div data-slot="toast-description">{item.description}</div>}
      </div>
      {item.action && (
        <button
          type="button"
          data-slot="toast-action"
          onClick={() => {
            item.action!.onClick();
            toast.dismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
      <button type="button" data-slot="toast-close" aria-label="Dismiss" onClick={() => toast.dismiss(item.id)}>
        <CloseIcon />
      </button>
    </div>
  );
}
