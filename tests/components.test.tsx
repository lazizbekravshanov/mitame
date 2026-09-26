import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { computePosition } from "../registry/hooks/use-anchor-position";
import { Button } from "../registry/ui/button";
import { Card, CardTitle } from "../registry/ui/card";
import { Checkbox } from "../registry/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "../registry/ui/dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../registry/ui/menu";
import { Popover, PopoverContent, PopoverTrigger } from "../registry/ui/popover";
import { Select } from "../registry/ui/select";
import { Slider } from "../registry/ui/slider";
import { Switch } from "../registry/ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "../registry/ui/tabs";
import { TextField } from "../registry/ui/text-field";
import { Toaster, toast } from "../registry/ui/toast";
import { Tooltip } from "../registry/ui/tooltip";
import { components } from "../site/src/data/components";

const isOpen = (el: Element) => el.hasAttribute("data-test-popover-open");

describe("Button", () => {
  it("defaults to type=button and exposes variant/size hooks", () => {
    render(<Button variant="primary" size="lg" className="mine">Save</Button>);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b.getAttribute("type")).toBe("button");
    expect(b.dataset.variant).toBe("primary");
    expect(b.dataset.size).toBe("lg");
    expect(b.className).toBe("mi-button mine");
  });
});

describe("Card", () => {
  it("renders slots", () => {
    render(<Card><CardTitle>Hi</CardTitle></Card>);
    expect(screen.getByRole("heading", { name: "Hi" }).closest('[data-slot="card"]')).not.toBeNull();
  });
});

describe("TextField", () => {
  it("links label, description and error", () => {
    render(<TextField label="Email" description="We never share it" error="Required" />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toEqual(["We never share it", "Required"]);
  });
});

describe("Checkbox + Switch", () => {
  it("checkbox toggles and supports indeterminate", async () => {
    const onChange = vi.fn();
    render(<Checkbox indeterminate onChange={onChange}>Backup</Checkbox>);
    const box = screen.getByRole("checkbox", { name: "Backup" }) as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    await userEvent.click(box);
    expect(box.checked).toBe(true);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("switch has the switch role", async () => {
    render(<Switch defaultChecked>Wi-Fi</Switch>);
    const sw = screen.getByRole("switch", { name: "Wi-Fi" }) as HTMLInputElement;
    expect(sw.checked).toBe(true);
    await userEvent.click(sw);
    expect(sw.checked).toBe(false);
  });
});

describe("Slider", () => {
  it("writes the fill percentage and reports numbers", () => {
    const onValueChange = vi.fn();
    render(<Slider aria-label="Volume" defaultValue={25} onValueChange={onValueChange} />);
    const s = screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement;
    expect(s.style.getPropertyValue("--mi-slider-fill")).toBe("25%");
    fireEvent.change(s, { target: { value: "80" } });
    expect(onValueChange).toHaveBeenCalledWith(80);
    expect(s.style.getPropertyValue("--mi-slider-fill")).toBe("80%");
  });
});

describe("Select", () => {
  const options = [
    { value: "apple", label: "Apple" },
    { value: "banana", label: "Banana", disabled: true },
    { value: "cherry", label: "Cherry" },
  ];

  it("opens, moves with arrows (skipping disabled), selects with Enter", async () => {
    const onValueChange = vi.fn();
    render(<Select aria-label="Fruit" options={options} onValueChange={onValueChange} name="fruit" />);
    const trigger = screen.getByRole("button", { name: "Fruit" });
    await userEvent.click(trigger);
    const list = screen.getByRole("listbox", { hidden: true });
    expect(isOpen(list)).toBe(true);
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Apple"));
    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent).toBe("Cherry");
    await userEvent.keyboard("{Enter}");
    expect(onValueChange).toHaveBeenCalledWith("cherry");
    expect(isOpen(list)).toBe(false);
    expect(trigger.textContent).toBe("Cherry");
    expect((document.querySelector('input[name="fruit"]') as HTMLInputElement).value).toBe("cherry");
    expect(document.activeElement).toBe(trigger);
  });

  it("typeahead jumps to a matching option", async () => {
    render(<Select aria-label="Fruit" options={options} />);
    await userEvent.click(screen.getByRole("button", { name: "Fruit" }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Apple"));
    await userEvent.keyboard("c");
    expect(document.activeElement?.textContent).toBe("Cherry");
  });
});

describe("Tabs", () => {
  it("arrow keys move and activate; panels follow", async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsPanel value="a">Panel A</TabsPanel>
        <TabsPanel value="b">Panel B</TabsPanel>
      </Tabs>,
    );
    const a = screen.getByRole("tab", { name: "A" });
    expect(a.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Panel A");
    a.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "B" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Panel B");
  });
});

describe("Menu", () => {
  it("opens from the trigger, runs onSelect, closes and refocuses", async () => {
    const onSelect = vi.fn();
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onSelect}>Copy</MenuItem>
          <MenuItem disabled>Paste</MenuItem>
        </MenuContent>
      </Menu>,
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    await userEvent.click(trigger);
    const menu = screen.getByRole("menu", { hidden: true });
    expect(isOpen(menu)).toBe(true);
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Copy"));
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledOnce();
    expect(isOpen(menu)).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

});

describe("Popover", () => {
  it("toggles through the native invoker and closes on Escape", async () => {
    render(
      <Popover>
        <PopoverTrigger>Details</PopoverTrigger>
        <PopoverContent>Hello</PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Details" });
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    await userEvent.keyboard("{Escape}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("Tooltip", () => {
  const setup = () => {
    render(
      <Tooltip content="Saves the file" delay={300}>
        <Button>Save</Button>
      </Tooltip>,
    );
    return { b: screen.getByRole("button", { name: "Save" }), tip: screen.getByRole("tooltip", { hidden: true }) };
  };

  it("shows on keyboard focus and describes the trigger", async () => {
    const { b, tip } = setup();
    await userEvent.tab();
    expect(document.activeElement).toBe(b);
    await waitFor(() => expect(isOpen(tip)).toBe(true));
    expect(b.getAttribute("aria-describedby")).toBe(tip.id);
    await userEvent.tab();
    expect(isOpen(tip)).toBe(false);
  });

  it("mouse hover shows after the delay and hides on leave", () => {
    vi.useFakeTimers();
    const { b, tip } = setup();
    fireEvent.pointerEnter(b, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(200));
    expect(isOpen(tip)).toBe(false);
    act(() => vi.advanceTimersByTime(150));
    expect(isOpen(tip)).toBe(true);
    fireEvent.pointerLeave(b, { pointerType: "mouse" });
    expect(isOpen(tip)).toBe(false);
    vi.useRealTimers();
  });

  it("touch: a tap does nothing, a long press shows it and it fades after release", () => {
    vi.useFakeTimers();
    const { b, tip } = setup();
    fireEvent.pointerEnter(b, { pointerType: "touch" });
    fireEvent.pointerDown(b, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(100));
    fireEvent.pointerUp(b, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(2000));
    expect(isOpen(tip)).toBe(false);

    fireEvent.pointerDown(b, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(600));
    expect(isOpen(tip)).toBe(true);
    fireEvent.pointerUp(b, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(1000));
    expect(isOpen(tip)).toBe(true);
    act(() => vi.advanceTimersByTime(600));
    expect(isOpen(tip)).toBe(false);
    vi.useRealTimers();
  });
});

describe("list items follow the mouse", () => {
  it("hovering a menu item focuses it so only one item is highlighted", async () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem>Copy</MenuItem>
          <MenuItem>Paste</MenuItem>
        </MenuContent>
      </Menu>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Copy"));
    const paste = screen.getByRole("menuitem", { name: "Paste", hidden: true });
    fireEvent.pointerMove(paste, { pointerType: "mouse" });
    expect(document.activeElement).toBe(paste);
    fireEvent.pointerLeave(paste, { pointerType: "mouse" });
    expect(document.activeElement).toBe(screen.getByRole("menu", { hidden: true }));
    fireEvent.pointerMove(paste, { pointerType: "touch" });
    expect(document.activeElement).not.toBe(paste);
  });
});

describe("Dialog", () => {
  function Demo() {
    const [log, setLog] = useState<string[]>([]);
    return (
      <>
        <Dialog onOpenChange={(o) => setLog((l) => [...l, String(o)])}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Delete file?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
            <DialogClose>Cancel</DialogClose>
          </DialogContent>
        </Dialog>
        <output>{log.join(",")}</output>
      </>
    );
  }

  it("opens as a labelled modal and closes via Close, Escape and backdrop", async () => {
    render(<Demo />);
    const dialog = document.querySelector("dialog")!;
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(dialog.open).toBe(true);
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent).toBe("Delete file?");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog.open).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    act(() => {
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    });
    expect(dialog.open).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(dialog);
    expect(dialog.open).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("true,false,true,false,true,false");
  });
});

describe("Toast", () => {
  it("shows, auto dismisses, and can be dismissed by hand", async () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.success("Saved", { description: "All good", duration: 1000 });
    });
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(document.querySelector('[data-slot="toaster"]')!.getAttribute("aria-live")).toBe("polite");
    act(() => vi.advanceTimersByTime(1100));
    expect(screen.queryByText("Saved")).toBeNull();

    let id = 0;
    act(() => {
      id = toast({ title: "Sticky", duration: Infinity });
    });
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText("Sticky")).toBeTruthy();
    act(() => toast.dismiss(id));
    expect(screen.queryByText("Sticky")).toBeNull();
    vi.useRealTimers();
  });
});

describe("computePosition", () => {
  const vp = { width: 1000, height: 800 };
  it("places below, flips above when there is no room, and clamps to the viewport", () => {
    expect(computePosition(new DOMRect(100, 100, 80, 30), { width: 200, height: 100 }, "bottom-start", vp)).toEqual({
      x: 100,
      y: 136,
      side: "bottom",
    });
    expect(computePosition(new DOMRect(100, 740, 80, 30), { width: 200, height: 100 }, "bottom-start", vp).side).toBe("top");
    expect(computePosition(new DOMRect(950, 100, 40, 30), { width: 200, height: 100 }, "bottom-start", vp).x).toBe(792);
  });
});

describe("server rendering", () => {
  it("holds back popoverTarget until mount, so a pre-hydration click cannot open an unpositioned popover", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(
      <>
        <Menu>
          <MenuTrigger>Actions</MenuTrigger>
          <MenuContent>
            <MenuItem>Copy</MenuItem>
          </MenuContent>
        </Menu>
        <Select aria-label="Era" options={[{ value: "y2k", label: "Y2K" }]} />
        <Popover>
          <PopoverTrigger>Details</PopoverTrigger>
          <PopoverContent>Hi</PopoverContent>
        </Popover>
      </>,
    );
    expect(html).not.toContain("popovertarget");
    // The popovers themselves still render, just not wired to their triggers yet.
    expect(html).toContain('popover="auto"');
  });

  it("wires the trigger up once mounted", async () => {
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem>Copy</MenuItem>
        </MenuContent>
      </Menu>,
    );
    const trigger = screen.getByRole("button", { name: "Actions" });
    await waitFor(() => expect(trigger.getAttribute("popovertarget")).toBeTruthy());
    expect(trigger.getAttribute("popovertarget")).toBe(screen.getByRole("menu", { hidden: true }).id);
  });
});

describe("a caller's props compose with the component's own handlers", () => {
  const tabs = (list: Record<string, unknown> = {}, trigger: Record<string, unknown> = {}) => (
    <Tabs defaultValue="a">
      <TabsList {...list}>
        <TabsTrigger value="a">A</TabsTrigger>
        <TabsTrigger value="b" {...trigger}>B</TabsTrigger>
      </TabsList>
      <TabsPanel value="a">Panel A</TabsPanel>
      <TabsPanel value="b">Panel B</TabsPanel>
    </Tabs>
  );

  it("Tabs still navigates and activates", async () => {
    const onKeyDown = vi.fn();
    const onClick = vi.fn();
    render(tabs({ onKeyDown }, { onClick }));
    await userEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole("tabpanel").textContent).toBe("Panel B");

    screen.getByRole("tab", { name: "B" }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onKeyDown).toHaveBeenCalled();
    expect(screen.getByRole("tabpanel").textContent).toBe("Panel A");
  });

  it("preventDefault in a caller's handler opts out of the built-in behavior", async () => {
    render(tabs({}, { onClick: (e: { preventDefault: () => void }) => e.preventDefault() }));
    await userEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByRole("tabpanel").textContent).toBe("Panel A");
  });

  it("MenuItem runs the caller's onClick and still selects", async () => {
    const onClick = vi.fn();
    const onSelect = vi.fn();
    render(
      <Menu>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={onSelect} onClick={onClick}>Copy</MenuItem>
        </MenuContent>
      </Menu>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Copy", hidden: true }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("Checkbox indeterminate", () => {
  it("keeps the dash after a click, because the prop is the source of truth", async () => {
    const onChange = vi.fn();
    render(<Checkbox indeterminate onChange={onChange}>Pick</Checkbox>);
    const input = screen.getByRole("checkbox") as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
    await userEvent.click(input);
    expect(onChange).toHaveBeenCalledOnce();
    // The browser clears it on click; the component puts it back.
    expect(input.indeterminate).toBe(true);
  });
});

describe("Tooltip placement", () => {
  it("measures the tip only after it is shown, never while it is display:none", () => {
    vi.useFakeTimers();
    render(
      <Tooltip content="Saves the file" delay={100}>
        <Button>Save</Button>
      </Tooltip>,
    );
    const tip = screen.getByRole("tooltip", { hidden: true });
    const measured: boolean[] = [];
    tip.getBoundingClientRect = () => {
      measured.push(isOpen(tip));
      return { x: 0, y: 0, width: 120, height: 28, top: 0, left: 0, right: 120, bottom: 28, toJSON: () => ({}) } as DOMRect;
    };
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Save" }), { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(150));
    expect(measured.length).toBeGreaterThan(0);
    expect(measured.every(Boolean)).toBe(true);
    vi.useRealTimers();
  });
});

describe("computePosition on a small screen", () => {
  it("pins an element bigger than the viewport to the top left edge, not past it", () => {
    const phone = { width: 360, height: 640 };
    const longMenu = { width: 420, height: 700 };
    expect(computePosition(new DOMRect(40, 300, 80, 30), longMenu, "bottom-start", phone)).toEqual({
      x: 8,
      y: 8,
      side: "bottom",
    });
  });
});

describe("mergeRefs", () => {
  it("runs a ref callback's cleanup instead of calling it with null", () => {
    const cleanup = vi.fn();
    const calls: (HTMLInputElement | null)[] = [];
    const view = render(
      <Checkbox
        ref={(node) => {
          calls.push(node);
          return cleanup;
        }}
      >
        Backup
      </Checkbox>,
    );
    expect(calls).toEqual([screen.getByRole("checkbox", { name: "Backup" })]);
    view.unmount();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(1);
  });

  it("stays attached to a consumer's ref across renders", async () => {
    const calls: (HTMLInputElement | null)[] = [];
    const keep = (node: HTMLInputElement | null) => void calls.push(node);
    function Host() {
      const [n, setN] = useState(0);
      return (
        <>
          <Checkbox ref={keep}>Backup</Checkbox>
          <button onClick={() => setN(n + 1)}>rerender {n}</button>
        </>
      );
    }
    render(<Host />);
    await userEvent.click(screen.getByRole("button", { name: "rerender 0" }));
    expect(calls).toEqual([screen.getByRole("checkbox", { name: "Backup" })]);
  });
});

describe("Dialog labelling and dismissal", () => {
  it("lets the caller's own aria props name and describe the dialog", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent aria-label="Pick a file" aria-describedby="hint">
          <DialogTitle>Delete file?</DialogTitle>
          <p id="hint">Only .png files.</p>
        </DialogContent>
      </Dialog>,
    );
    const dialog = document.querySelector("dialog")!;
    expect(screen.getByRole("dialog", { name: "Pick a file" })).toBe(dialog);
    expect(dialog.hasAttribute("aria-labelledby")).toBe(false);
    expect(dialog.getAttribute("aria-describedby")).toBe("hint");
  });

  it("falls back to its own title and description", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Delete file?</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const dialog = document.querySelector("dialog")!;
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent).toBe("Delete file?");
    expect(document.getElementById(dialog.getAttribute("aria-describedby")!)!.textContent).toBe("This cannot be undone.");
  });

  it("stays open when a drag crosses the panel edge, in either direction", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Delete file?</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const dialog = document.querySelector("dialog")!;
    const panel = dialog.querySelector('[data-slot="dialog-panel"]')!;

    // Selecting text in the panel and releasing past its edge.
    fireEvent.mouseDown(panel);
    fireEvent.mouseUp(dialog);
    fireEvent.click(dialog);
    expect(dialog.hasAttribute("open")).toBe(true);

    // And the same gesture the other way round.
    fireEvent.mouseDown(dialog);
    fireEvent.mouseUp(panel);
    fireEvent.click(dialog);
    expect(dialog.hasAttribute("open")).toBe(true);

    // A real click on the backdrop still dismisses.
    fireEvent.mouseDown(dialog);
    fireEvent.mouseUp(dialog);
    fireEvent.click(dialog);
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("does not let a stale press survive into the next click", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Delete file?</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    const dialog = document.querySelector("dialog")!;
    const panel = dialog.querySelector('[data-slot="dialog-panel"]')!;
    fireEvent.mouseDown(panel);
    fireEvent.mouseUp(dialog);
    fireEvent.click(dialog);
    // A click with no press of its own must not reuse the last one.
    fireEvent.click(dialog);
    expect(dialog.hasAttribute("open")).toBe(true);
  });
});

describe("Toast", () => {
  it("keeps focus inside the region when another toast arrives", () => {
    render(<Toaster />);
    act(() => {
      toast({ title: "First", duration: Infinity, action: { label: "Undo", onClick: () => {} } });
    });
    const region = document.querySelector('[data-slot="toaster"]') as HTMLElement;
    const toggles: string[] = [];
    region.addEventListener("toggle", (e) => toggles.push((e as Event & { newState: string }).newState));
    const undo = screen.getByRole("button", { name: "Undo", hidden: true });
    act(() => undo.focus());
    act(() => {
      toast({ title: "Second", duration: Infinity });
    });
    expect(toggles).toEqual([]);
    expect(document.activeElement).toBe(undo);
    act(() => toast.dismiss());
  });

  it("falls back to its defaults when a caller passes undefined", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast({ title: "Loose", variant: undefined, duration: undefined });
    });
    expect(screen.getByText("Loose").closest<HTMLElement>('[data-slot="toast"]')!.dataset.variant).toBe("default");
    act(() => vi.advanceTimersByTime(4100));
    expect(screen.queryByText("Loose")).toBeNull();
    vi.useRealTimers();
  });
});

describe("Slider in a form", () => {
  it("resets with the form when uncontrolled", () => {
    const onValueChange = vi.fn();
    render(
      <form>
        <Slider aria-label="Volume" name="volume" defaultValue={25} onValueChange={onValueChange} />
        <button type="reset">Reset</button>
      </form>,
    );
    const s = screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement;
    fireEvent.change(s, { target: { value: "80" } });
    expect(new FormData(s.form!).get("volume")).toBe("80");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(s.value).toBe("25");
    expect(new FormData(s.form!).get("volume")).toBe("25");
  });

  it("keeps a controlled value through a form reset", () => {
    function App() {
      const [v, setV] = useState(40);
      return (
        <form>
          <Slider aria-label="Vol" value={v} onValueChange={setV} />
          <button type="reset">Reset</button>
        </form>
      );
    }
    render(<App />);
    const s = screen.getByRole("slider", { name: "Vol" }) as HTMLInputElement;
    fireEvent.change(s, { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(s.value).toBe("90");
  });
});

describe("a disabled Select is not a successful control", () => {
  const form = (disabled: boolean) => (
    <form>
      <Select aria-label="Fruit" name="fruit" defaultValue="apple" options={[{ value: "apple", label: "Apple" }]} disabled={disabled} />
    </form>
  );

  it("submits nothing while disabled", () => {
    render(form(true));
    expect([...new FormData(document.querySelector("form")!).keys()]).toEqual([]);
  });

  it("still submits the value when enabled", () => {
    render(form(false));
    expect(new FormData(document.querySelector("form")!).get("fruit")).toBe("apple");
  });
});

describe("Tabs keeps exactly one tab in the tab order", () => {
  const tabs = (defaultValue: string, disabled = false) => (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="a" disabled={disabled}>A</TabsTrigger>
        <TabsTrigger value="b">B</TabsTrigger>
      </TabsList>
      <TabsPanel value="a">Panel A</TabsPanel>
      <TabsPanel value="b">Panel B</TabsPanel>
    </Tabs>
  );

  it("hands the tab stop to the first enabled tab when the value matches none", async () => {
    render(tabs(""));
    const [a, b] = screen.getAllByRole("tab");
    expect([a!.tabIndex, b!.tabIndex]).toEqual([0, -1]);
    await userEvent.tab();
    expect(document.activeElement).toBe(a);
  });

  it("skips a disabled first tab", () => {
    render(tabs("", true));
    expect(screen.getAllByRole("tab").map((t) => t.tabIndex)).toEqual([-1, 0]);
  });

  it("gives the tab stop back once a tab is selected", async () => {
    render(tabs(""));
    const [a, b] = screen.getAllByRole("tab");
    await userEvent.click(b!);
    expect([a!.tabIndex, b!.tabIndex]).toEqual([-1, 0]);
  });
});

/** What the browser fires just before it shows a popover. True if the show was canceled. */
function askToOpen(el: Element) {
  const e = new Event("beforetoggle", { cancelable: true }) as Event & { newState: string; oldState: string };
  e.newState = "open";
  e.oldState = "closed";
  act(() => {
    el.dispatchEvent(e);
  });
  return e.defaultPrevented;
}

describe("controlled Popover", () => {
  it("a parent that keeps open false keeps the popover shut and still hears the click", () => {
    const onOpenChange = vi.fn();
    render(
      <Popover open={false} onOpenChange={onOpenChange}>
        <PopoverTrigger>Details</PopoverTrigger>
        <PopoverContent>Hello</PopoverContent>
      </Popover>,
    );
    const content = screen.getByRole("dialog", { hidden: true });
    expect(askToOpen(content)).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(isOpen(content)).toBe(false);
  });

  it("opens on the parent's answer, and that show is not vetoed again", async () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>Details</PopoverTrigger>
          <PopoverContent>Hello</PopoverContent>
        </Popover>
      );
    }
    render(<Controlled />);
    const content = screen.getByRole("dialog", { hidden: true });
    expect(askToOpen(content)).toBe(true);
    await waitFor(() => expect(isOpen(content)).toBe(true));
    expect(askToOpen(content)).toBe(false);
  });
});

describe("controlled Menu", () => {
  it("cannot be opened behind a parent's back", () => {
    const onOpenChange = vi.fn();
    render(
      <Menu open={false} onOpenChange={onOpenChange}>
        <MenuTrigger>Actions</MenuTrigger>
        <MenuContent>
          <MenuItem>Copy</MenuItem>
        </MenuContent>
      </Menu>,
    );
    const content = screen.getByRole("menu", { hidden: true });
    expect(askToOpen(content)).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(isOpen(content)).toBe(false);
  });
});

describe("docs prop tables", () => {
  const docProps = (slug: string) => components.find((c) => c.slug === slug)!.props.map((p) => p.name);

  it("documents the passthrough wherever a component forwards input attributes", () => {
    // The Slider demo on the page passes aria-label, which only arrives through the spread.
    expect(docProps("slider")).toContain("...props");
    expect(docProps("text-field")).toContain("...props");
  });

  it("documents Select's disabled prop, which no passthrough row implies", () => {
    expect(docProps("select")).toContain("disabled");
  });

  it("only uses token utilities the Tailwind bridge generates", () => {
    const root = join(import.meta.dirname, "..");
    const layout = readFileSync(join(root, "site/src/layouts/Docs.astro"), "utf8");
    const bridge = readFileSync(join(root, "registry/themes/tailwind.css"), "utf8");
    const used = [...layout.matchAll(/\b(?:text|bg|border)-((?:mi|fy)-[a-z-]+)\b/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const token of used) expect(bridge).toContain(`--color-${token}:`);
  });
});
