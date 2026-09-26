import { useId, useState, type FormEvent } from "react";
import { WarningIcon } from "../icons/warning";
import { Button } from "../ui/button";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../ui/dialog";
import { Select } from "../ui/select";
import { Switch } from "../ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "../ui/tabs";
import { TextField } from "../ui/text-field";

/** The name a person has to type before the account can be deleted. */
const ACCOUNT = "acme-industries";

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "appearance", label: "Appearance" },
  { id: "danger", label: "Danger zone" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

type NotificationId = "mentions" | "comments" | "releases" | "digest";

const NOTIFICATIONS: { id: NotificationId; label: string; help: string }[] = [
  { id: "mentions", label: "Mentions", help: "Someone writes your name in a comment or a review." },
  { id: "comments", label: "Replies to your work", help: "Every reply on a page you own, as it happens." },
  { id: "releases", label: "Release notes", help: "A short note when we ship something new." },
  { id: "digest", label: "Digest email", help: "One roundup instead of a message per event." },
];

const DIGEST = [
  { value: "daily", label: "Every morning" },
  { value: "weekly", label: "Monday mornings" },
  { value: "monthly", label: "First of the month" },
];

const THEMES = [
  { value: "system", label: "Match system" },
  { value: "light", label: "Always light" },
  { value: "dark", label: "Always dark" },
];

const DENSITIES = [
  { value: "compact", label: "Compact", help: "Tighter rows, so more of the list fits on screen." },
  { value: "cosy", label: "Cosy", help: "The default. Enough room to scan a long list." },
  { value: "roomy", label: "Roomy", help: "Bigger targets, which helps on a phone." },
];

const PREVIEW_ROWS = ["Weekly planning", "Design review", "Release 2.4"];

const PROFILE = {
  name: "Lena Ortiz",
  email: "lena@acme.co",
  bio: "Design engineer. I keep the component library honest.",
};

const BIO_LIMIT = 160;

/** Settings with a section rail, live switches and a confirm-by-typing delete. */
export default function Settings() {
  const uid = useId();
  const [section, setSection] = useState<SectionId>("profile");

  // Two copies of the profile, so Save can tell whether anything actually moved
  // instead of lighting up the moment a field is touched.
  const [draft, setDraft] = useState(PROFILE);
  const [saved, setSaved] = useState(PROFILE);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = draft.name !== saved.name || draft.email !== saved.email || draft.bio !== saved.bio;

  const [notify, setNotify] = useState<Record<NotificationId, boolean>>({
    mentions: true,
    comments: false,
    releases: true,
    digest: true,
  });
  const [digest, setDigest] = useState("weekly");

  const [theme, setTheme] = useState("system");
  const [density, setDensity] = useState("cosy");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [scheduled, setScheduled] = useState(false);

  const panelId = `${uid}-panel`;
  const bioId = `${uid}-bio`;
  const typedId = `${uid}-typed`;
  const activeLabel = SECTIONS.find((item) => item.id === section)?.label ?? "";
  const themeLabel = THEMES.find((item) => item.value === theme)?.label ?? theme;
  const densityLabel = DENSITIES.find((item) => item.value === density)?.label ?? density;
  const matches = typed.trim() === ACCOUNT;

  function update(patch: Partial<typeof PROFILE>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setJustSaved(false);
  }

  function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(draft);
    setJustSaved(true);
  }

  function closeConfirm(next: boolean) {
    setConfirmOpen(next);
    // A half typed name should not survive a cancel, or reopening the dialog
    // would hand the user an already armed delete button.
    if (!next) setTyped("");
  }

  return (
    <div className="mi-block mi-settings">
      <header className="mi-settings-head">
        <h1 className="mi-settings-h1">Settings</h1>
        <p className="mi-block-muted">Your account, and how Acme gets in touch.</p>
      </header>

      <div className="mi-settings-body">
        <nav className="mi-settings-nav" aria-label="Settings sections">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="mi-settings-nav-item"
              aria-current={section === item.id ? "true" : undefined}
              aria-controls={panelId}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mi-settings-panel" id={panelId} role="region" aria-label={activeLabel}>
          {section === "profile" && (
            <form onSubmit={saveProfile}>
              <Card>
                <CardHeader>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>This is what teammates see next to your comments.</CardDescription>
                </CardHeader>
                <CardBody className="mi-block-stack">
                  <TextField
                    label="Full name"
                    autoComplete="name"
                    value={draft.name}
                    onChange={(e) => update({ name: e.currentTarget.value })}
                    required
                  />
                  <TextField
                    label="Email"
                    type="email"
                    autoComplete="email"
                    description="Invoices and password resets go here."
                    value={draft.email}
                    onChange={(e) => update({ email: e.currentTarget.value })}
                    required
                  />
                  {/* mitame has no textarea component yet, so the bio wears the same
                      field slots TextField renders and inherits every theme's input
                      treatment. Only the height is ours. */}
                  <div data-slot="field" className="mi-field">
                    <label data-slot="field-label" htmlFor={bioId}>
                      Short bio
                    </label>
                    <div data-slot="field-control">
                      <textarea
                        id={bioId}
                        data-slot="field-input"
                        className="mi-settings-bio"
                        rows={3}
                        maxLength={BIO_LIMIT}
                        aria-describedby={`${bioId}-desc`}
                        value={draft.bio}
                        onChange={(e) => update({ bio: e.currentTarget.value })}
                      />
                    </div>
                    <p data-slot="field-description" id={`${bioId}-desc`}>
                      {BIO_LIMIT - draft.bio.length} characters left.
                    </p>
                  </div>
                </CardBody>
                <CardFooter className="mi-settings-foot">
                  <p className="mi-settings-status" role="status">
                    {justSaved ? "Profile saved." : dirty ? "Unsaved changes." : ""}
                  </p>
                  <span className="mi-block-row">
                    <Button
                      disabled={!dirty}
                      onClick={() => {
                        setDraft(saved);
                        setJustSaved(false);
                      }}
                    >
                      Discard
                    </Button>
                    <Button type="submit" variant="primary" disabled={!dirty}>
                      Save changes
                    </Button>
                  </span>
                </CardFooter>
              </Card>
            </form>
          )}

          {section === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Pick what is worth an email. The rest stays in the app.</CardDescription>
              </CardHeader>
              <CardBody className="mi-settings-rows">
                {NOTIFICATIONS.map((item) => (
                  <div key={item.id} className="mi-settings-row">
                    <div>
                      <p className="mi-settings-row-label" id={`${uid}-n-${item.id}`}>
                        {item.label}
                      </p>
                      <p className="mi-settings-row-help" id={`${uid}-n-${item.id}-help`}>
                        {item.help}
                      </p>
                    </div>
                    <Switch
                      checked={notify[item.id]}
                      aria-labelledby={`${uid}-n-${item.id}`}
                      aria-describedby={`${uid}-n-${item.id}-help`}
                      onChange={(e) => {
                        // Read the checkbox before the updater runs. React clears
                        // currentTarget when the handler returns, and the updater
                        // is called later, during the next render.
                        const on = e.currentTarget.checked;
                        setNotify((prev) => ({ ...prev, [item.id]: on }));
                      }}
                    />
                  </div>
                ))}
              </CardBody>
              <CardBody>
                <div className="mi-settings-field">
                  <span className="mi-settings-label" id={`${uid}-digest`}>
                    Digest frequency
                  </span>
                  <Select
                    options={DIGEST}
                    value={digest}
                    onValueChange={setDigest}
                    disabled={!notify.digest}
                    aria-labelledby={`${uid}-digest`}
                    aria-describedby={`${uid}-digest-help`}
                  />
                  <p className="mi-settings-help" id={`${uid}-digest-help`}>
                    {notify.digest
                      ? "One email, sent when you asked for it."
                      : "Turn the digest email on to choose a frequency."}
                  </p>
                </div>
              </CardBody>
            </Card>
          )}

          {section === "appearance" && (
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Changes how the app looks for you, nobody else.</CardDescription>
              </CardHeader>
              <CardBody className="mi-block-stack">
                <div className="mi-settings-field">
                  <span className="mi-settings-label" id={`${uid}-theme`}>
                    Theme
                  </span>
                  <Select options={THEMES} value={theme} onValueChange={setTheme} aria-labelledby={`${uid}-theme`} />
                </div>

                {/* Each panel draws the same three rows at its own density, so the
                    tabs show what they mean rather than describing it. */}
                <Tabs value={density} onValueChange={setDensity}>
                  <span className="mi-settings-label" id={`${uid}-density`}>
                    Density
                  </span>
                  <TabsList aria-labelledby={`${uid}-density`}>
                    {DENSITIES.map((item) => (
                      <TabsTrigger key={item.value} value={item.value}>
                        {item.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {DENSITIES.map((item) => (
                    <TabsPanel key={item.value} value={item.value}>
                      <p className="mi-settings-help">{item.help}</p>
                      <ul className="mi-settings-preview" data-density={item.value} aria-label={`${item.label} preview`}>
                        {PREVIEW_ROWS.map((row) => (
                          <li key={row}>{row}</li>
                        ))}
                      </ul>
                    </TabsPanel>
                  ))}
                </Tabs>

                <p className="mi-settings-status" role="status">
                  {themeLabel}, {densityLabel.toLowerCase()} rows.
                </p>
              </CardBody>
            </Card>
          )}

          {section === "danger" && (
            <Card className="mi-settings-danger">
              <CardHeader>
                <CardTitle className="mi-settings-danger-title">
                  <WarningIcon aria-hidden="true" />
                  Danger zone
                </CardTitle>
                <CardDescription>
                  Deleting the account removes every project, theme and invite that belongs to it. Support cannot bring
                  it back once the grace period ends.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <dl className="mi-settings-facts">
                  <div>
                    <dt>Account</dt>
                    <dd>
                      <code className="mi-settings-code">{ACCOUNT}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Projects</dt>
                    <dd>14</dd>
                  </div>
                  <div>
                    <dt>Teammates</dt>
                    <dd>6</dd>
                  </div>
                </dl>
              </CardBody>
              <CardFooter className="mi-settings-danger-foot">
                {scheduled ? (
                  <>
                    <p className="mi-settings-status" role="status">
                      <WarningIcon aria-hidden="true" />
                      Deletion scheduled. You have 14 days to change your mind.
                    </p>
                    <Button onClick={() => setScheduled(false)}>Cancel deletion</Button>
                  </>
                ) : (
                  <Button variant="danger" aria-haspopup="dialog" onClick={() => setConfirmOpen(true)}>
                    Delete account
                  </Button>
                )}
              </CardFooter>

              <Dialog open={confirmOpen} onOpenChange={closeConfirm}>
                <DialogContent>
                  <DialogTitle>Delete this account?</DialogTitle>
                  <DialogDescription>
                    14 projects go away and 6 teammates are signed out. Nothing happens for 14 days, and after that it
                    is gone.
                  </DialogDescription>
                  <TextField
                    id={typedId}
                    label={
                      <>
                        Type <code className="mi-settings-code">{ACCOUNT}</code> to confirm
                      </>
                    }
                    description="Delete stays switched off until this matches exactly."
                    value={typed}
                    onChange={(e) => setTyped(e.currentTarget.value)}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                  <DialogFooter>
                    <DialogClose>Keep account</DialogClose>
                    <Button
                      variant="danger"
                      disabled={!matches}
                      aria-describedby={`${typedId}-desc`}
                      onClick={() => {
                        setScheduled(true);
                        closeConfirm(false);
                      }}
                    >
                      Delete account
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
