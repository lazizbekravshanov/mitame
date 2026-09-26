import { useRef, useState, type FormEvent } from "react";
import { SearchIcon } from "../icons/search";
import { SuccessIcon } from "../icons/success";
import { WarningIcon } from "../icons/warning";
import { Button } from "../ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { TextField } from "../ui/text-field";

const NAV = [
  { label: "Features", href: "#kestrel-features" },
  { label: "Customers", href: "#kestrel-customers" },
  { label: "Results", href: "#kestrel-results" },
];

const PROOF = ["Free for 14 days", "No card to start", "Runs next to your CI"];

const CUSTOMERS = ["Northbeam", "Tidepool", "Cobalt Freight", "Halden Labs", "Verity Bank"];

const FEATURES = [
  {
    Icon: SearchIcon,
    title: "Every release, searchable",
    body: "Commits, authors and services are indexed the moment they ship, so you can find the exact minute something broke.",
  },
  {
    Icon: WarningIcon,
    title: "Alerts that name a name",
    body: "Routing follows code ownership instead of a rota, so the person who shipped the change hears about it first.",
  },
  {
    Icon: SuccessIcon,
    title: "Rollback in one step",
    body: "Any release can drop back to the last good build from the same screen, and the alert closes itself when it does.",
  },
];

const RESULTS = [
  { value: "6 min", label: "median time to recovery" },
  { value: "12,400", label: "deploys watched every day" },
  { value: "99.98%", label: "alerts delivered inside ten seconds" },
];

/** Marketing page for a made up product. Swap the copy, keep the shape. */
export default function Landing() {
  const [open, setOpen] = useState(false);
  const [signedUp, setSignedUp] = useState<string | null>(null);
  // The header link and the hero button should land in the same place, so the
  // button scrolls to the section the link jumps to instead of a second target.
  const features = useRef<HTMLElement>(null);

  function showFeatures() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    features.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSignedUp(String(form.get("email") ?? ""));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reopening should offer the form again, not yesterday's receipt.
        if (!next) setSignedUp(null);
      }}
    >
      <div className="mi-block mi-landing">
        <header className="mi-landing-header">
          <div className="mi-landing-inner">
            <p className="mi-landing-brand">
              <span className="mi-auth-mark" aria-hidden="true">
                k
              </span>
              Kestrel
            </p>
            <nav className="mi-landing-nav" aria-label="Kestrel">
              {NAV.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
            <DialogTrigger data-variant="primary">Start free</DialogTrigger>
          </div>
        </header>

        <section className="mi-landing-hero">
          <div className="mi-landing-inner">
            <p className="mi-landing-eyebrow">Public beta</p>
            <h1 className="mi-landing-headline">Ship on Friday. Sleep on Saturday.</h1>
            <p className="mi-landing-sub">
              Kestrel watches every deploy, spots the one that went sideways and pages the person who wrote the line. You
              get a quiet weekend instead of a war room.
            </p>
            <div className="mi-landing-actions">
              <DialogTrigger data-variant="primary" data-size="lg">
                Start free
              </DialogTrigger>
              <Button size="lg" onClick={showFeatures}>
                See what it does
              </Button>
            </div>
            <ul className="mi-landing-proof">
              {PROOF.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mi-landing-logos" aria-labelledby="kestrel-logos">
          <div className="mi-landing-inner">
            <h2 className="mi-landing-logos-label" id="kestrel-logos">
              Watching deploys at
            </h2>
            <ul>
              {CUSTOMERS.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mi-landing-features" id="kestrel-features" ref={features}>
          <div className="mi-landing-inner">
            <div className="mi-landing-head">
              <h2 className="mi-block-title">Three things, done properly</h2>
              <p className="mi-block-lede">
                Kestrel is not trying to be your dashboard. It watches deploys, tells the right person and then gets out
                of the way.
              </p>
            </div>
            <div className="mi-landing-grid">
              {FEATURES.map(({ Icon, title, body }) => (
                <Card key={title}>
                  <span className="mi-landing-feature-icon">
                    <Icon width="20" height="20" />
                  </span>
                  <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{body}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="mi-landing-quote" id="kestrel-customers">
          <div className="mi-landing-inner">
            <figure className="mi-landing-quote-figure">
              <blockquote className="mi-landing-quote-text">
                We went from a forty minute scramble to a six minute fix, and the on call week stopped being the one
                everybody dreads.
              </blockquote>
              <figcaption className="mi-landing-quote-by">
                <strong>Priya Raman</strong>
                <span>Head of Platform, Tidepool</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="mi-landing-results" id="kestrel-results" aria-labelledby="kestrel-results-label">
          <div className="mi-landing-inner">
            <h2 className="mi-landing-results-label" id="kestrel-results-label">
              Measured across 1,900 teams
            </h2>
            <dl className="mi-landing-stats">
              {RESULTS.map((stat) => (
                <div className="mi-landing-stat" key={stat.label}>
                  <dt className="mi-landing-stat-label">{stat.label}</dt>
                  <dd className="mi-landing-stat-value">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mi-landing-cta">
          <div className="mi-landing-inner">
            <div className="mi-landing-cta-panel">
              <h2 className="mi-landing-cta-title">Put your next deploy on watch</h2>
              <p className="mi-landing-cta-sub">
                Connect a repository and Kestrel picks up the next release. There is nothing to install on your servers.
              </p>
              <DialogTrigger data-variant="primary" data-size="lg">
                Start free
              </DialogTrigger>
              <a className="mi-landing-cta-link" href="#contact">
                Talk to an engineer instead
              </a>
            </div>
          </div>
        </section>
      </div>

      <DialogContent>
        {signedUp === null ? (
          <>
            <DialogTitle>Create your workspace</DialogTitle>
            <DialogDescription>Fourteen days free. We only ask for a card when you invite a second person.</DialogDescription>
            <form className="mi-block-stack" onSubmit={submit}>
              <TextField
                label="Work email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
              <TextField label="Team name" name="team" autoComplete="organization" placeholder="Platform" required />
              <Checkbox name="changelog" defaultChecked>
                Send me the monthly changelog
              </Checkbox>
              <DialogFooter>
                <DialogClose>Cancel</DialogClose>
                <Button variant="primary" type="submit">
                  Create workspace
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogTitle>Check your inbox</DialogTitle>
            <DialogDescription>We sent a link to {signedUp}. It stops working after an hour.</DialogDescription>
            <DialogFooter>
              {/* The submit button that had focus is gone now, so hand focus to what replaced it. */}
              <DialogClose data-variant="primary" autoFocus>
                Done
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
