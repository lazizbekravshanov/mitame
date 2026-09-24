import { SearchIcon } from "@mitame/icons/search";
import { TextField } from "@mitame/ui/text-field";

export default function TextFieldDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <TextField label="Search" placeholder="Find anything" icon={<SearchIcon />} />
      <TextField label="Email" type="email" placeholder="you@example.com" description="We never share it." />
      <TextField label="Username" defaultValue="me" error="Must be at least 3 characters." />
    </div>
  );
}
