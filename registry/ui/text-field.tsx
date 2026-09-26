import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  description?: ReactNode;
  /** Shows the message and marks the input invalid. */
  error?: ReactNode;
  /** Leading icon, for example <SearchIcon />. */
  icon?: ReactNode;
  ref?: React.Ref<HTMLInputElement>;
}

export function TextField({ label, description, error, icon, id, className, ...props }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const descId = description ? `${inputId}-desc` : undefined;
  const errId = error ? `${inputId}-err` : undefined;
  const describedBy = [props["aria-describedby"], descId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div data-slot="field" data-invalid={error ? "" : undefined} className={cn("mi-field", className)}>
      {label && (
        <label data-slot="field-label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div data-slot="field-control">
        {icon && <span data-slot="field-icon">{icon}</span>}
        <input
          id={inputId}
          data-slot="field-input"
          {...props}
          aria-describedby={describedBy}
          aria-invalid={error ? true : props["aria-invalid"]}
        />
      </div>
      {description && (
        <p data-slot="field-description" id={descId}>
          {description}
        </p>
      )}
      {error && (
        <p data-slot="field-error" id={errId}>
          {error}
        </p>
      )}
    </div>
  );
}
