import { InfoIcon } from "@mitame/icons/info";
import { Button } from "@mitame/ui/button";
import { Tooltip } from "@mitame/ui/tooltip";

export default function TooltipDemo() {
  return (
    <div className="flex items-center gap-3">
      <Tooltip content="Saved to your account">
        <Button variant="primary">Save</Button>
      </Tooltip>
      <Tooltip content="More about plans" placement="right">
        <Button variant="ghost" aria-label="More about plans">
          <InfoIcon />
        </Button>
      </Tooltip>
    </div>
  );
}
