import { Checkbox } from "@mitame/ui/checkbox";

export default function CheckboxDemo() {
  return (
    <div className="flex flex-col gap-3">
      <Checkbox defaultChecked>Email me about replies</Checkbox>
      <Checkbox indeterminate>Some projects selected</Checkbox>
      <Checkbox disabled>Unavailable</Checkbox>
    </div>
  );
}
