import { Popover, PopoverContent, PopoverTrigger } from "@mitame/ui/popover";

export default function PopoverDemo() {
  return (
    <Popover>
      <PopoverTrigger>Share</PopoverTrigger>
      <PopoverContent className="w-64 text-sm">
        <p className="m-0 font-semibold">Anyone with the link</p>
        <p className="mt-1 mb-0 opacity-70">Can view this project. Click outside or press Esc to close.</p>
      </PopoverContent>
    </Popover>
  );
}
