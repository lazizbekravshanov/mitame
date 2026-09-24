import { Switch } from "@mitame/ui/switch";

export default function SwitchDemo() {
  return (
    <div className="flex flex-col gap-3">
      <Switch defaultChecked>Notifications</Switch>
      <Switch>Dark wallpaper</Switch>
    </div>
  );
}
