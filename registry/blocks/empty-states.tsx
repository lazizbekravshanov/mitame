import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CheckIcon } from "../icons/check";
import { CloseIcon } from "../icons/close";
import { DotIcon } from "../icons/dot";
import { ErrorIcon } from "../icons/error";
import { MinusIcon } from "../icons/minus";
import { PlusIcon } from "../icons/plus";
import { SearchIcon } from "../icons/search";
import { Button } from "../ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../ui/dialog";
import { TextField } from "../ui/text-field";

/** A query that matches none of the cards, which is the point of it. */
const MISS = "asparagus";

interface EmptyState {
  id: string;
  /** The label above the title, and the first thing the filter matches. */
  kind: string;
  tone: "accent" | "neutral" | "danger" | "warning";
  icon: ReactNode;
  title: string;
  copy: ReactNode;
  /** Extra words the filter matches, so "403" finds the permission card. */
  terms: string;
  actions: ReactNode;
  /** Live feedback under the actions, for the cards that have any. */
  note?: ReactNode;
}

/**
 * Five empty states as a gallery, so you can copy the one you need. The filter
 * above the cards is real, and searching for something that is not here leaves
 * the no results card to answer for itself.
 */
export default function EmptyStates() {
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [project, setProject] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [attempts, setAttempts] = useState(1);
  const [online, setOnline] = useState(true);
  const [requested, setRequested] = useState(false);

  // The offline card reports the real connection rather than miming one. The
  // first paint says online on the server and in the browser, so the markup
  // matches and the effect corrects it a tick later.
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  // There is no server behind a block, so the retry lands back on the error.
  // What a user is copying here is a control that moves while it works.
  useEffect(() => {
    if (!retrying) return;
    const timer = setTimeout(() => {
      setRetrying(false);
      setAttempts((n) => n + 1);
    }, 900);
    return () => clearTimeout(timer);
  }, [retrying]);

  const q = query.trim().toLowerCase();
  // Someone will paste an essay in there, and the card should survive it.
  const echo = (query.trim() || MISS).slice(0, 48);

  function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setProject(name);
    setDraft("");
    setDialogOpen(false);
  }

  const states: EmptyState[] = [
    {
      id: "empty",
      kind: "Empty",
      tone: "accent",
      icon: <PlusIcon />,
      title: "No projects yet",
      copy: "A project holds your deploys, your domains and your logs. Make the first one and this page fills itself in.",
      terms: "empty nothing first blank onboarding project create",
      actions: (
        <>
          <Button variant="primary" onClick={() => setDialogOpen(true)}>
            Create a project
          </Button>
          <a className="mi-emptystates-link" href="#import">
            Import one instead
          </a>
        </>
      ),
      note: project ? (
        <p className="mi-emptystates-note" role="status">
          <CheckIcon />
          Created “{project}”.
          <Button variant="ghost" size="sm" onClick={() => setProject(null)}>
            Undo
          </Button>
        </p>
      ) : undefined,
    },
    {
      id: "no-results",
      kind: "No results",
      tone: "neutral",
      icon: <SearchIcon />,
      title: "Nothing matched",
      copy: (
        <>
          We looked for <strong className="mi-emptystates-echo">“{echo}”</strong> and came back with nothing. Check the
          spelling, or drop the filter and browse.
        </>
      ),
      terms: "no results search filter query found miss nothing",
      actions: q ? (
        <Button variant="primary" onClick={() => setQuery("")}>
          Clear the filter
        </Button>
      ) : (
        <Button variant="primary" onClick={() => setQuery(MISS)}>
          Search for “{MISS}”
        </Button>
      ),
    },
    {
      id: "error",
      kind: "Failed",
      tone: "danger",
      icon: <ErrorIcon />,
      title: "Could not load your deploys",
      copy: "The request came back empty handed. That is usually on us, so it is worth trying again.",
      terms: "error failed crash retry broken problem load",
      actions: (
        <>
          <Button variant="primary" onClick={() => setRetrying(true)} disabled={retrying}>
            {retrying ? "Retrying…" : "Try again"}
          </Button>
          <a className="mi-emptystates-link" href="#status">
            Status page
          </a>
        </>
      ),
      note: (
        <p className="mi-emptystates-note" role="status">
          {retrying
            ? "Talking to the server…"
            : `${attempts} ${attempts === 1 ? "attempt" : "attempts"} failed. Reference 7c1f.`}
        </p>
      ),
    },
    {
      id: "offline",
      kind: "Offline",
      tone: "warning",
      // A flat line reads as no signal, and mitame has no plug or antenna icon.
      icon: <MinusIcon />,
      title: "You are offline",
      copy: "Your edits are saved on this device. They go up the moment the connection comes back.",
      terms: "offline network connection disconnected reconnect wifi",
      actions: (
        <Button variant="primary" onClick={() => setOnline(navigator.onLine)}>
          Check again
        </Button>
      ),
      note: (
        <p className="mi-emptystates-note" role="status">
          <DotIcon className="mi-emptystates-dot" data-online={online ? "" : undefined} />
          Your browser reports {online ? "a connection" : "no connection"}.
        </p>
      ),
    },
    {
      id: "denied",
      kind: "Denied",
      tone: "danger",
      icon: <CloseIcon />,
      title: "You do not have access",
      copy: "This workspace is private. Ask an owner for a seat and the page opens itself.",
      terms: "permission denied access locked forbidden private 403",
      actions: requested ? (
        <Button variant="ghost" onClick={() => setRequested(false)}>
          Cancel request
        </Button>
      ) : (
        <>
          <Button variant="primary" onClick={() => setRequested(true)}>
            Request access
          </Button>
          <a className="mi-emptystates-link" href="#switch">
            Use another account
          </a>
        </>
      ),
      note: requested ? (
        <p className="mi-emptystates-note" role="status">
          <CheckIcon />
          Sent to the workspace owner.
        </p>
      ) : undefined,
    },
  ];

  const matches = q
    ? states.filter((state) => `${state.kind} ${state.title} ${state.terms}`.toLowerCase().includes(q))
    : states;
  const missed = matches.length === 0;
  const shown = missed ? states.filter((state) => state.id === "no-results") : matches;

  return (
    <section className="mi-block mi-block-section">
      <div className="mi-block-head">
        <h2 className="mi-block-title">Empty states</h2>
        <p className="mi-block-lede">
          The five screens people meet on a bad day. Copy the one you need, then write the sentence in your own voice.
        </p>
      </div>

      <div className="mi-emptystates-tools">
        <TextField
          className="mi-emptystates-search"
          label="Find a state"
          placeholder="offline, denied, asparagus"
          icon={<SearchIcon />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <Button onClick={() => setQuery("")} disabled={!query}>
          Clear
        </Button>
      </div>
      <p className="mi-emptystates-count" role="status">
        {missed ? `Nothing matches “${echo}”` : `Showing ${shown.length} of ${states.length}`}
      </p>

      <div className="mi-emptystates-gallery" data-solo={missed ? "" : undefined}>
        {shown.map((state) => (
          <Card key={state.id} className="mi-emptystates-card" data-tone={state.tone}>
            <CardHeader className="mi-emptystates-head">
              <span className="mi-emptystates-badge" aria-hidden="true">
                {state.icon}
              </span>
              <p className="mi-emptystates-kind">{state.kind}</p>
              <CardTitle>{state.title}</CardTitle>
              <CardDescription className="mi-emptystates-copy">{state.copy}</CardDescription>
            </CardHeader>
            <CardFooter className="mi-emptystates-foot">
              <div className="mi-emptystates-actions">{state.actions}</div>
              {state.note}
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>A name is all it takes, and you can change it later.</DialogDescription>
          <form className="mi-emptystates-form" onSubmit={create}>
            <TextField
              label="Project name"
              placeholder="Blue whale"
              value={draft}
              onChange={(e) => setDraft(e.currentTarget.value)}
              required
            />
            <DialogFooter>
              <DialogClose>Cancel</DialogClose>
              <Button type="submit" variant="primary">
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
