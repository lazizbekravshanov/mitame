import { Button } from "@mitame/ui/button";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "@mitame/ui/card";
import { Checkbox } from "@mitame/ui/checkbox";
import { Select } from "@mitame/ui/select";
import { Slider } from "@mitame/ui/slider";
import { Switch } from "@mitame/ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@mitame/ui/tabs";
import { TextField } from "@mitame/ui/text-field";

const LABEL: Record<string, string> = {
  aqua: "Y2K · aqua · 2001",
  liquid: "Now · liquid · 2026",
  platinum: "Vintage · platinum · 1997",
};

/** 1270x760 gallery shot for Product Hunt: the same screen in each era. */
export default function ShotGallery({ theme }: { theme: string }) {
  return (
    <div className="shot shot-gallery wallpaper">
      <p className="gallery-title">{LABEL[theme]}</p>
      <Card style={{ width: "560px" }}>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>One set of components. Every era.</CardDescription>
        </CardHeader>
        <Tabs defaultValue="general">
          <TabsList aria-label="Preferences">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="sound">Sound</TabsTrigger>
          </TabsList>
          <TabsPanel value="general">
            <CardBody style={{ display: "flex", flexDirection: "column", gap: "18px", paddingTop: "8px" }}>
              <TextField label="Display name" defaultValue="Ada" />
              <Select aria-label="Language" defaultValue="en" options={[{ value: "en", label: "English" }]} />
              <div style={{ display: "flex", gap: "28px", alignItems: "center" }}>
                <Switch defaultChecked>Notifications</Switch>
                <Checkbox defaultChecked>Weekly digest</Checkbox>
              </div>
              <Slider aria-label="Volume" defaultValue={64} />
            </CardBody>
          </TabsPanel>
        </Tabs>
        <CardFooter>
          <Button>Reset</Button>
          <Button variant="primary">Save</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
