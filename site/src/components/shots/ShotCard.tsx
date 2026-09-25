import { Button } from "@mitame/ui/button";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "@mitame/ui/card";
import { Checkbox } from "@mitame/ui/checkbox";
import { Select } from "@mitame/ui/select";
import { Switch } from "@mitame/ui/switch";

const ERA: Record<string, string> = {
  aqua: "Y2K · 2001",
  liquid: "Now · 2026",
  platinum: "Vintage · 1997",
  brutalist: "Style · brutalist",
  minimal: "Style · minimal",
  urban: "Style · urban",
};

/** 1200x630 social card. Rendered static, screenshotted by scripts/build-social.mjs. */
export default function ShotCard({ theme }: { theme: string }) {
  const era = ERA[theme] ?? "";
  return (
    <div className="shot shot-card wallpaper">
      <div style={{ flex: 1 }}>
        <p className="era-badge">{era}</p>
        <h1 className="wordmark">mitame</h1>
        <p className="jp">見た目</p>
        <p className="tagline">
          <strong>Old UI, brought back to life.</strong>
        </p>
        <p className="sub">Copy-paste React components that wear any era, from 2001 Aqua gel to 2026 liquid glass.</p>
        <span className="cmd">npx @lazizbekio/mitame add button</span>
      </div>
      <div className="stage" style={{ flex: "0 0 470px" }}>
        <Card style={{ width: "470px" }}>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Same code. New 見た目.</CardDescription>
          </CardHeader>
          <CardBody style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <Select aria-label="Era" defaultValue={theme} options={[{ value: theme, label: era }]} />
            <div style={{ display: "flex", gap: "28px", alignItems: "center" }}>
              <Switch defaultChecked>Notifications</Switch>
              <Checkbox defaultChecked>Digest</Checkbox>
            </div>
          </CardBody>
          <CardFooter>
            <Button>Reset</Button>
            <Button variant="primary">Save</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
