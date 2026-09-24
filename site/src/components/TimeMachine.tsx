import { useState } from "react";
import { Button } from "@mitame/ui/button";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "@mitame/ui/card";
import { Checkbox } from "@mitame/ui/checkbox";
import { Select } from "@mitame/ui/select";
import { Slider } from "@mitame/ui/slider";
import { Switch } from "@mitame/ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@mitame/ui/tabs";
import { TextField } from "@mitame/ui/text-field";
import { Toaster, toast } from "@mitame/ui/toast";
import { THEMES, setTheme, useTheme, type ThemeId } from "../lib/theme";

/** The landing page hero: one screen, every era. */
export default function TimeMachine() {
  const { theme } = useTheme();
  const [volume, setVolume] = useState(60);

  return (
    <div className="flex flex-col gap-6">
      <div role="group" aria-label="Era" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {THEMES.map((t) => {
          const active = t.id === theme;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              disabled={!t.ready}
              onClick={() => t.ready && setTheme(t.id as ThemeId)}
              className="era-chip"
              data-active={active || undefined}
            >
              <span className="era-chip-year">{t.year}</span>
              <span className="era-chip-name">
                {t.era} · {t.id}
              </span>
              {!t.ready && <span className="era-chip-soon">soon</span>}
            </button>
          );
        })}
      </div>

      <Card className="mx-auto w-full max-w-xl">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Same components, same code. Only the era changes.</CardDescription>
        </CardHeader>
        <Tabs defaultValue="general">
          <TabsList aria-label="Preferences">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="sound">Sound</TabsTrigger>
          </TabsList>
          <TabsPanel value="general">
            <CardBody className="flex flex-col gap-4 pt-2">
              <TextField label="Display name" defaultValue="Ada" />
              <Select
                aria-label="Language"
                defaultValue="en"
                options={[
                  { value: "en", label: "English" },
                  { value: "uz", label: "Oʻzbekcha" },
                  { value: "ja", label: "日本語" },
                ]}
              />
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                <Switch defaultChecked>Notifications</Switch>
                <Checkbox defaultChecked>Weekly digest</Checkbox>
              </div>
            </CardBody>
          </TabsPanel>
          <TabsPanel value="sound">
            <CardBody className="flex flex-col gap-4 pt-2">
              <div className="flex items-center gap-4">
                <Slider aria-label="Volume" value={volume} onValueChange={setVolume} />
                <span className="w-8 text-right text-sm tabular-nums">{volume}</span>
              </div>
              <Checkbox>Play a sound on new messages</Checkbox>
            </CardBody>
          </TabsPanel>
        </Tabs>
        <CardFooter>
          <Button>Reset</Button>
          <Button variant="primary" onClick={() => toast.success("Preferences saved")}>
            Save
          </Button>
        </CardFooter>
      </Card>
      <Toaster />
    </div>
  );
}
