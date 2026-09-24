import { Tabs, TabsList, TabsTrigger } from "@mitame/ui/tabs";
import { setMode, setTheme, useTheme, type Mode, type ThemeId } from "../lib/theme";

export default function ThemeSwitcher() {
  const { theme, mode } = useTheme();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={theme} onValueChange={(v) => setTheme(v as ThemeId)}>
        <TabsList aria-label="Theme">
          <TabsTrigger value="aqua">Aqua</TabsTrigger>
          <TabsTrigger value="liquid">Liquid</TabsTrigger>
        </TabsList>
      </Tabs>
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList aria-label="Color mode">
          <TabsTrigger value="system">Auto</TabsTrigger>
          <TabsTrigger value="light">Light</TabsTrigger>
          <TabsTrigger value="dark">Dark</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
