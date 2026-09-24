// Local showcase of every component. Not shipped.
import { useState } from "react";
import { InfoIcon } from "../registry/icons/info";
import { MoreIcon } from "../registry/icons/more";
import { PlusIcon } from "../registry/icons/plus";
import { SearchIcon } from "../registry/icons/search";
import { Button } from "../registry/ui/button";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "../registry/ui/card";
import { Checkbox } from "../registry/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger } from "../registry/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "../registry/ui/menu";
import { Popover, PopoverContent, PopoverTrigger } from "../registry/ui/popover";
import { Select } from "../registry/ui/select";
import { Slider } from "../registry/ui/slider";
import { Switch } from "../registry/ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "../registry/ui/tabs";
import { TextField } from "../registry/ui/text-field";
import { Toaster, toast } from "../registry/ui/toast";
import { Tooltip } from "../registry/ui/tooltip";

type Mode = "system" | "light" | "dark";
type Theme = "aqua" | "liquid";
const ERA: Record<Theme, string> = { aqua: "Y2K era", liquid: "Now era" };

export function App() {
  const [mode, setMode] = useState<Mode>("system");
  const [theme, setTheme] = useState<Theme>("aqua");
  const [volume, setVolume] = useState(64);

  const setDocMode = (m: Mode) => {
    setMode(m);
    if (m === "system") document.documentElement.removeAttribute("data-mode");
    else document.documentElement.setAttribute("data-mode", m);
  };

  const setDocTheme = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  };

  return (
    <div className="wallpaper min-h-screen px-4 py-10 text-mi-fg">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-mi-fg-muted">mitame · {ERA[theme]}</p>
            <h1 className="m-0 text-4xl font-bold tracking-tight">{theme}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Tabs value={theme} onValueChange={(v) => setDocTheme(v as Theme)}>
              <TabsList aria-label="Theme">
                <TabsTrigger value="aqua">Aqua</TabsTrigger>
                <TabsTrigger value="liquid">Liquid</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={mode} onValueChange={(v) => setDocMode(v as Mode)}>
              <TabsList aria-label="Color mode">
                <TabsTrigger value="system">System</TabsTrigger>
                <TabsTrigger value="light">Light</TabsTrigger>
                <TabsTrigger value="dark">Dark</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>Gel primary, glass secondary, quiet ghost.</CardDescription>
            </CardHeader>
            <CardBody className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Save</Button>
              <Button>Cancel</Button>
              <Button variant="ghost">Skip</Button>
              <Button variant="danger">Delete</Button>
              <Button size="sm">
                <PlusIcon /> Small
              </Button>
              <Button disabled>Disabled</Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Text field</CardTitle>
              <CardDescription>Labels, hints and errors are wired for screen readers.</CardDescription>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <TextField label="Search" placeholder="Find anything" icon={<SearchIcon />} />
              <TextField label="Email" placeholder="you@example.com" error="That doesn't look like an email." defaultValue="you@" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Toggles</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <Checkbox defaultChecked>Keep a backup copy</Checkbox>
              <Checkbox indeterminate>Some files selected</Checkbox>
              <Checkbox disabled>Disabled</Checkbox>
              <div className="flex flex-wrap gap-6 pt-2">
                <Switch defaultChecked>Wi-Fi</Switch>
                <Switch>Bluetooth</Switch>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slider + Select</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <Slider aria-label="Volume" value={volume} onValueChange={setVolume} />
                <span className="w-10 text-right text-sm tabular-nums text-mi-fg-muted">{volume}</span>
              </div>
              <Select
                aria-label="Era"
                defaultValue="now"
                options={[
                  { value: "vintage", label: "Vintage · 1984 to 1999" },
                  { value: "y2k", label: "Y2K · 2000 to 2012" },
                  { value: "now", label: "Now · 2025+" },
                  { value: "remix", label: "Remix", disabled: true },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tabs</CardTitle>
            </CardHeader>
            <Tabs defaultValue="general">
              <TabsList aria-label="Settings">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>
              <TabsPanel value="general" className="text-sm text-mi-fg-muted">Name, language and startup.</TabsPanel>
              <TabsPanel value="appearance" className="text-sm text-mi-fg-muted">Glass tint, accent and motion.</TabsPanel>
              <TabsPanel value="advanced" className="text-sm text-mi-fg-muted">Here be dragons.</TabsPanel>
            </Tabs>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overlays</CardTitle>
              <CardDescription>Menu, popover, tooltip, dialog and toast, all in the top layer.</CardDescription>
            </CardHeader>
            <CardBody className="flex flex-wrap items-center gap-3">
              <Menu>
                <MenuTrigger aria-label="More">
                  <MoreIcon /> Menu
                </MenuTrigger>
                <MenuContent>
                  <MenuLabel>Project</MenuLabel>
                  <MenuItem onSelect={() => toast("Renamed")}>Rename</MenuItem>
                  <MenuItem onSelect={() => toast("Duplicated")}>Duplicate</MenuItem>
                  <MenuItem disabled>Share…</MenuItem>
                  <MenuSeparator />
                  <MenuItem variant="danger" onSelect={() => toast.error("Project deleted")}>Delete</MenuItem>
                </MenuContent>
              </Menu>

              <Popover>
                <PopoverTrigger>Popover</PopoverTrigger>
                <PopoverContent className="w-64 text-sm">
                  <p className="m-0 font-semibold">Glass all the way down</p>
                  <p className="mt-1 mb-0 text-mi-fg-muted">Outside click or Escape closes me. The browser does that part.</p>
                </PopoverContent>
              </Popover>

              <Tooltip content="Tooltips show on hover and focus">
                <Button variant="ghost" aria-label="Info">
                  <InfoIcon />
                </Button>
              </Tooltip>

              <Dialog>
                <DialogTrigger>Dialog</DialogTrigger>
                <DialogContent>
                  <DialogTitle>Delete this project?</DialogTitle>
                  <DialogDescription>12 pages will be gone for good. This can't be undone.</DialogDescription>
                  <DialogFooter>
                    <DialogClose>Cancel</DialogClose>
                    <DialogClose data-variant="danger" onClick={() => toast.success("Project deleted")}>
                      Delete
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button
                variant="primary"
                onClick={() =>
                  toast.success("Changes saved", {
                    description: "Your profile is up to date.",
                    action: { label: "Undo", onClick: () => toast("Undone") },
                  })
                }
              >
                Toast
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
