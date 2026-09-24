import { useState } from "react";
import { Slider } from "@mitame/ui/slider";

export default function SliderDemo() {
  const [volume, setVolume] = useState(64);
  return (
    <div className="flex w-full max-w-sm items-center gap-4">
      <Slider aria-label="Volume" value={volume} onValueChange={setVolume} />
      <span className="w-8 text-right text-sm tabular-nums">{volume}</span>
    </div>
  );
}
