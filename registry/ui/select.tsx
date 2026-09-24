import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useAnchorPosition } from "../hooks/use-anchor-position";
import { useControllable } from "../hooks/use-controllable";
import { useListNavigation } from "../hooks/use-list-navigation";
import { usePopover } from "../hooks/use-popover";
import { CheckIcon } from "../icons/check";
import { ChevronDownIcon } from "../icons/chevron-down";
import { cn } from "../lib/cn";
import { pointerFocus } from "../lib/pointer-focus";

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: ReactNode;
  /** Form field name; a hidden input carries the value. */
  name?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/** The classic popup menu: a button that opens a listbox in the top layer. */
export function Select({
  options,
  value,
  defaultValue = "",
  onValueChange,
  placeholder = "Select…",
  name,
  disabled,
  id,
  className,
  ...aria
}: SelectProps) {
  const [current, setCurrent] = useControllable(value, defaultValue, onValueChange);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();

  usePopover(list, open, (next) => {
    setOpen(next);
    if (next) requestAnimationFrame(focusCurrent);
  });
  useAnchorPosition(trigger, list, open, "bottom-start", true);
  const nav = useListNavigation(list, { itemSelector: '[role="option"]', typeahead: true, loop: false });

  const selected = options.find((o) => o.value === current);

  function focusCurrent() {
    const el =
      list.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]') ??
      list.current?.querySelector<HTMLElement>('[role="option"]:not([aria-disabled="true"])');
    el?.focus();
  }

  function choose(option: SelectOption) {
    if (option.disabled) return;
    setCurrent(option.value);
    setOpen(false);
    trigger.current?.focus();
  }

  function onTriggerKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const idx = (document.activeElement as HTMLElement | null)?.dataset.index;
      const option = idx !== undefined ? options[Number(idx)] : undefined;
      if (option) choose(option);
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
      return;
    }
    nav.onKeyDown(e);
  }

  return (
    <div data-slot="select" className={cn("mi-select", className)}>
      <button
        ref={trigger}
        id={id}
        type="button"
        data-slot="select-trigger"
        data-placeholder={selected ? undefined : ""}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        popoverTarget={listId}
        onKeyDown={onTriggerKeyDown}
        {...aria}
      >
        <span data-slot="select-value">{selected ? selected.label : placeholder}</span>
        <ChevronDownIcon data-slot="select-chevron" />
      </button>
      <div
        ref={list}
        id={listId}
        popover="auto"
        role="listbox"
        tabIndex={-1}
        data-slot="select-content"
        data-mi-floating=""
        data-state={open ? "open" : "closed"}
        onKeyDown={onListKeyDown}
      >
        {options.map((o, i) => (
          <div
            key={o.value}
            role="option"
            tabIndex={-1}
            data-index={i}
            data-slot="select-item"
            aria-selected={o.value === current}
            aria-disabled={o.disabled || undefined}
            onClick={() => choose(o)}
            {...pointerFocus}
          >
            <span data-slot="select-item-label">{o.label}</span>
            {o.value === current && <CheckIcon data-slot="select-item-check" />}
          </div>
        ))}
      </div>
      {name && <input type="hidden" name={name} value={current} />}
    </div>
  );
}
