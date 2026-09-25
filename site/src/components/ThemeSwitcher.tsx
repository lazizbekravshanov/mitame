import { Select } from "@mitame/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@mitame/ui/tabs";
import { ERAS, STYLES, setMode, setTheme, useTheme, type Mode, type Theme, type ThemeId } from "../lib/theme";

const label = (t: Theme) => `${t.era} · ${t.id}`;

export default function ThemeSwitcher() {
  const { theme, mode } = useTheme();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        aria-label="Theme"
        className="min-w-[190px]"
        value={theme}
        onValueChange={(v) => setTheme(v as ThemeId)}
        options={[
          ...ERAS.map((t) => ({ value: t.id, label: label(t) })),
          ...STYLES.map((t) => ({ value: t.id, label: label(t) })),
        ]}
      />
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
