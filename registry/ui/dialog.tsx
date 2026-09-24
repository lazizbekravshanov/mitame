import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { CloseIcon } from "../icons/close";
import { cn } from "../lib/cn";

interface DialogContext {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descId: string;
}
const Ctx = createContext<DialogContext | null>(null);
const useDialog = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Dialog parts must be inside <Dialog>");
  return ctx;
};

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open: controlled, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [inner, setInner] = useState(defaultOpen);
  const open = controlled ?? inner;
  const setOpen = (next: boolean) => {
    if (next === open) return;
    if (controlled === undefined) setInner(next);
    onOpenChange?.(next);
  };
  const id = useId();
  return <Ctx.Provider value={{ open, setOpen, titleId: `${id}-title`, descId: `${id}-desc` }}>{children}</Ctx.Provider>;
}

export function DialogTrigger({ className, onClick, ...props }: HTMLAttributes<HTMLButtonElement>) {
  const { open, setOpen } = useDialog();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      data-slot="dialog-trigger"
      data-variant="secondary"
      data-size="md"
      className={cn("mi-button", className)}
      onClick={(e) => {
        onClick?.(e);
        setOpen(true);
      }}
      {...props}
    />
  );
}

export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  /** Close when the backdrop is clicked. Default true. */
  dismissible?: boolean;
  /** Show the × button in the corner. Default true. */
  showClose?: boolean;
}

/** A native modal <dialog>: focus trap, Escape and inert page come from the browser. */
export function DialogContent({ dismissible = true, showClose = true, className, children, ...props }: DialogContentProps) {
  const { open, setOpen, titleId, descId } = useDialog();
  const ref = useRef<HTMLDialogElement>(null);
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      setOpenRef.current(false);
    };
    const onClose = () => setOpenRef.current(false);
    el.addEventListener("cancel", onCancel);
    el.addEventListener("close", onClose);
    return () => {
      el.removeEventListener("cancel", onCancel);
      el.removeEventListener("close", onClose);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      data-slot="dialog"
      data-state={open ? "open" : "closed"}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div data-slot="dialog-panel" className={cn("mi-dialog", className)} {...props}>
        {children}
        {showClose && (
          <button type="button" data-slot="dialog-close-icon" aria-label="Close" onClick={() => setOpen(false)}>
            <CloseIcon />
          </button>
        )}
      </div>
    </dialog>
  );
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDialog();
  return <h2 id={titleId} data-slot="dialog-title" className={className} {...props} />;
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const { descId } = useDialog();
  return <p id={descId} data-slot="dialog-description" className={className} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="dialog-footer" className={className} {...props} />;
}

/** Wrap any button to make it close the dialog. */
export function DialogClose({ className, onClick, ...props }: HTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useDialog();
  return (
    <button
      type="button"
      data-slot="dialog-close"
      data-variant="secondary"
      data-size="md"
      className={cn("mi-button", className)}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    />
  );
}
