import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({ variant = "secondary", size = "md", type = "button", className, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn("mi-button", className)}
      {...props}
    />
  );
}
