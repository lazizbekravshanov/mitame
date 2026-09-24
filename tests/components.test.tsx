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
