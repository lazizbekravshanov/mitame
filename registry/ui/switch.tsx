import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> {
  children?: ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

/** A native checkbox with role="switch", drawn as a glass track and thumb. */
export function Switch({ children, className, ...props }: SwitchProps) {
  return (
    <label data-slot="switch" data-disabled={props.disabled ? "" : undefined} className={cn("mi-switch", className)}>
      <input type="checkbox" role="switch" data-slot="switch-input" {...props} />
      <span data-slot="switch-track" aria-hidden="true">
        <span data-slot="switch-thumb" />
      </span>
      {children && <span data-slot="switch-label">{children}</span>}
    </label>
  );
}
