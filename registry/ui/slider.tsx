import type { CSSProperties, InputHTMLAttributes } from "react";
import { useControllable } from "../hooks/use-controllable";
import { cn } from "../lib/cn";

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
export function Slider({ value, defaultValue, onValueChange, min = 0, max = 100, className, style, ...props }: SliderProps) {
  const [current, setCurrent] = useControllable(value, defaultValue ?? min, onValueChange);
  const fill = max > min ? ((current - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      data-slot="slider"
      min={min}
      max={max}
      value={current}
      onChange={(e) => setCurrent(e.currentTarget.valueAsNumber)}
      className={cn("mi-slider", className)}
      style={{ "--mi-slider-fill": `${fill}%`, ...style } as CSSProperties}
      {...props}
    />
  );
}
