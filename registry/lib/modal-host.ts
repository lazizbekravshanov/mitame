// While a modal <dialog> is open, the browser makes everything outside its
// subtree inert, top layer or not. Anything that must stay interactive (the
// toast region) has to move inside the open dialog. This is the meeting point:
// a Dialog registers its element while it is shown modally, and the Toaster
// follows the newest one. Module level, like the toast store, because the two
// components never see each other in the tree.

let hosts: HTMLElement[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Called by a dialog when it opens modally. Returns the matching unregister. */
export function registerModalHost(el: HTMLElement): () => void {
  hosts = [...hosts, el];
  emit();
  return () => {
    hosts = hosts.filter((h) => h !== el);
    emit();
  };
}

export function subscribeModalHost(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The newest open modal dialog, or null when the page is not blocked by one. */
export function modalHost(): HTMLElement | null {
  return hosts[hosts.length - 1] ?? null;
}
