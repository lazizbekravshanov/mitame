import { useLayoutEffect, useMemo, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { CheckIcon } from "../icons/check";
import { MinusIcon } from "../icons/minus";
import { cn } from "../lib/cn";
import { mergeRefs } from "../lib/refs";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Shows a dash instead of a check. It stays until you clear the prop, so
   * resolve the third state in your own `onChange`. */
  indeterminate?: boolean;
  children?: ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

/** A native checkbox with a custom box. Keyboard, forms and a11y come from the browser. */
export function Checkbox({ indeterminate = false, children, className, ref, onChange, ...props }: CheckboxProps) {
  const inner = useRef<HTMLInputElement>(null);
  // A click clears `indeterminate` in the DOM, so re-apply it on every render
  // and right after a change: otherwise the box silently stops matching the prop.
  const sync = () => {
    if (inner.current) inner.current.indeterminate = indeterminate;
  };
  useLayoutEffect(sync);
  // A fresh merged ref each render would detach and reattach a caller's
  // callback ref every time, so keep one for as long as their ref holds.
  const setInput = useMemo(() => mergeRefs(inner, ref), [ref]);

  return (
    <label data-slot="checkbox" data-disabled={props.disabled ? "" : undefined} className={cn("mi-checkbox", className)}>
      <input
        ref={setInput}
        type="checkbox"
        data-slot="checkbox-input"
        {...props}
        onChange={(e) => {
          onChange?.(e);
          sync();
        }}
      />
      <span data-slot="checkbox-box" aria-hidden="true">
        <CheckIcon data-slot="checkbox-check" />
        <MinusIcon data-slot="checkbox-dash" />
      </span>
      {children && <span data-slot="checkbox-label">{children}</span>}
    </label>
  );
}
