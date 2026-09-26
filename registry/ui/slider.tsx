import { useEffect, useMemo, useRef, type CSSProperties, type InputHTMLAttributes } from "react";
import { useControllable } from "../hooks/use-controllable";
import { cn } from "../lib/cn";
import { mergeRefs } from "../lib/refs";

export interface SliderProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue" | "onChange"> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  ref?: React.Ref<HTMLInputElement>;
}

/** A native range input. The filled part of the track reads `--mi-slider-fill`. */
export function Slider({ value, defaultValue, onValueChange, min = 0, max = 100, className, style, ref, ...props }: SliderProps) {
  const start = defaultValue ?? min;
  const [current, setCurrent] = useControllable(value, start, onValueChange);
  const controlled = value !== undefined;
  const fill = max > min ? ((current - min) / (max - min)) * 100 : 0;
  const inner = useRef<HTMLInputElement>(null);
  // A fresh merged ref each render would detach and reattach a caller's callback
  // ref every time, so keep one for as long as their ref holds.
  const setInput = useMemo(() => mergeRefs(inner, ref), [ref]);

  // With no `value` prop the browser puts the thumb back on a form reset, but the
  // fill is ours to move. The reset event fires before the input changes, so use
  // the default the browser is about to restore.
  useEffect(() => {
    const form = inner.current?.form;
    if (controlled || !form) return;
    const onReset = () => setCurrent(start);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, start, setCurrent]);

  return (
    <input
      ref={setInput}
      type="range"
      data-slot="slider"
      min={min}
      max={max}
      // Uncontrolled it stays a real form control, so it resets natively like the
      // other inputs. A controlled one keeps following the prop.
      value={controlled ? current : undefined}
      defaultValue={controlled ? undefined : start}
      onChange={(e) => setCurrent(e.currentTarget.valueAsNumber)}
      className={cn("mi-slider", className)}
      style={{ "--mi-slider-fill": `${fill}%`, ...style } as CSSProperties}
      {...props}
    />
  );
}
