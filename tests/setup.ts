// jsdom has no Popover API and no modal <dialog>. These small shims mimic the
// browser closely enough for behavior tests (state + toggle/close events).
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

const openPopovers = new WeakSet<HTMLElement>();

function fireToggle(el: HTMLElement, newState: "open" | "closed") {
  const e = new Event("toggle") as Event & { newState: string; oldState: string };
  e.newState = newState;
  e.oldState = newState === "open" ? "closed" : "open";
  el.dispatchEvent(e);
}

Object.assign(HTMLElement.prototype, {
  showPopover(this: HTMLElement) {
    if (openPopovers.has(this)) throw new DOMException("already open", "InvalidStateError");
    openPopovers.add(this);
    this.setAttribute("data-test-popover-open", "");
    // jsdom's UA sheet keeps [popover] at display none and has no :popover-open,
    // so without this the accessibility tree computes no name for open popovers.
    this.style.display = "block";
    fireToggle(this, "open");
  },
  hidePopover(this: HTMLElement) {
    if (!openPopovers.has(this)) return;
    openPopovers.delete(this);
    this.removeAttribute("data-test-popover-open");
    this.style.display = "";
    fireToggle(this, "closed");
  },
});

// Native invokers: clicking a button with popovertarget toggles its popover.
document.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest?.("button[popovertarget]");
  if (!btn) return;
  const target = document.getElementById(btn.getAttribute("popovertarget")!);
  if (!target) return;
  if (openPopovers.has(target)) target.hidePopover();
  else target.showPopover();
});

// Light dismiss on Escape for popover="auto".
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  document.querySelectorAll<HTMLElement>('[popover="auto"][data-test-popover-open]').forEach((el) => el.hidePopover());
});

// :popover-open is not a selector jsdom knows; map it to our marker attribute.
const matches = Element.prototype.matches;
Element.prototype.matches = function (this: Element, sel: string) {
  return matches.call(this, sel.replaceAll(":popover-open", "[data-test-popover-open]"));
} as typeof Element.prototype.matches;

HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  if (!this.hasAttribute("open")) return;
  this.removeAttribute("open");
  this.dispatchEvent(new Event("close"));
};

globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number;
