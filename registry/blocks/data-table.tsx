import { useRef, useState } from "react";
import { CheckIcon } from "../icons/check";
import { ChevronDownIcon } from "../icons/chevron-down";
import { ChevronUpIcon } from "../icons/chevron-up";
import { MoreIcon } from "../icons/more";
import { SearchIcon } from "../icons/search";
import { Button } from "../ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "../ui/menu";
import { Select } from "../ui/select";
import { TextField } from "../ui/text-field";

type Status = "live" | "building" | "failed" | "paused";
type SortKey = "name" | "requests";
type ColumnKey = "owner" | "status" | "requests";

interface Project {
  id: string;
  name: string;
  owner: string;
  status: Status;
  requests: number;
}

const STATUS_LABEL: Record<Status, string> = {
  live: "Live",
  building: "Building",
  failed: "Failed",
  paused: "Paused",
};

const OWNERS = ["Mina Okada", "Ravi Patel", "Jonas Weber", "Lena Fischer", "Tomás Silva"];

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "owner", label: "Owner" },
  { key: "status", label: "Status" },
  { key: "requests", label: "Requests" },
];

const PROJECTS: Project[] = [
  { id: "prj_01", name: "marketing-site", owner: "Mina Okada", status: "live", requests: 184203 },
  { id: "prj_02", name: "docs", owner: "Mina Okada", status: "live", requests: 96740 },
  { id: "prj_03", name: "api-gateway", owner: "Ravi Patel", status: "live", requests: 512880 },
  { id: "prj_04", name: "checkout", owner: "Ravi Patel", status: "building", requests: 74310 },
  { id: "prj_05", name: "dashboard", owner: "Jonas Weber", status: "live", requests: 61204 },
  { id: "prj_06", name: "auth-service", owner: "Lena Fischer", status: "failed", requests: 45120 },
  { id: "prj_07", name: "image-proxy", owner: "Tomás Silva", status: "live", requests: 238914 },
  { id: "prj_08", name: "blog", owner: "Mina Okada", status: "paused", requests: 1820 },
  { id: "prj_09", name: "status-page", owner: "Jonas Weber", status: "live", requests: 30411 },
  { id: "prj_10", name: "webhooks", owner: "Ravi Patel", status: "building", requests: 18730 },
  { id: "prj_11", name: "search-index", owner: "Lena Fischer", status: "live", requests: 88260 },
  { id: "prj_12", name: "billing", owner: "Tomás Silva", status: "live", requests: 22940 },
  { id: "prj_13", name: "admin", owner: "Jonas Weber", status: "paused", requests: 940 },
  { id: "prj_14", name: "cdn-edge", owner: "Ravi Patel", status: "live", requests: 764120 },
  { id: "prj_15", name: "mailer", owner: "Lena Fischer", status: "failed", requests: 6410 },
  { id: "prj_16", name: "analytics", owner: "Mina Okada", status: "live", requests: 143902 },
  { id: "prj_17", name: "feature-flags", owner: "Tomás Silva", status: "building", requests: 12040 },
  { id: "prj_18", name: "playground", owner: "Jonas Weber", status: "paused", requests: 3120 },
  { id: "prj_19", name: "changelog", owner: "Mina Okada", status: "live", requests: 9840 },
  { id: "prj_20", name: "design-tokens", owner: "Lena Fischer", status: "live", requests: 5210 },
];

const PAGE_SIZE = 8;

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  ...(Object.keys(STATUS_LABEL) as Status[]).map((value) => ({ value, label: STATUS_LABEL[value] })),
];

const OWNER_FILTERS = [{ value: "all", label: "All owners" }, ...OWNERS.map((name) => ({ value: name, label: name }))];

/** Group digits by hand, so the server and the browser print the same string. */
function grouped(n: number) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function plural(n: number) {
  return n === 1 ? "project" : "projects";
}

/**
 * Search, two filters, column visibility, sorting, selection with bulk actions
 * and paging. Every piece of it is local state, so the block runs anywhere.
 */
export default function DataTable() {
  const [rows, setRows] = useState(PROJECTS);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "requests", dir: "desc" });
  const [shown, setShown] = useState<Record<ColumnKey, boolean>>({ owner: true, status: true, requests: true });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  // A duplicate needs an id nothing else holds, and a ref counts without
  // asking for a render of its own.
  const copies = useRef(0);

  const needle = query.trim().toLowerCase();
  const filtered = rows
    .filter((row) => {
      const found = !needle || row.name.includes(needle) || row.owner.toLowerCase().includes(needle);
      return found && (status === "all" || row.status === status) && (owner === "all" || row.owner === owner);
    })
    // Project names are lowercase ascii, so a plain comparison orders them the
    // same in every runtime. That matters when a server renders the first page.
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.key === "requests") return (a.requests - b.requests) * dir;
      return (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) * dir;
    });

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // A filter or a delete can strand the page you were on, so read a clamped
  // page instead of trusting the stored one.
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const pickedHere = visible.filter((row) => selected.has(row.id)).length;
  const allPicked = visible.length > 0 && pickedHere === visible.length;
  const columnCount = 3 + COLUMNS.filter((col) => shown[col.key]).length;

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  function toggleColumn(key: ColumnKey) {
    setShown((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleRow(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAllOnPage(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of visible) {
        if (on) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setOwner("all");
    setPage(1);
  }

  function removeRows(ids: string[], message: string) {
    const gone = new Set(ids);
    setRows((prev) => prev.filter((row) => !gone.has(row.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
    setNotice(message);
  }

  // The button says export, so it exports. A blob and an anchor are all a CSV needs.
  function exportSelected() {
    const picks = rows.filter((row) => selected.has(row.id));
    const csv = [
      "project,owner,status,requests",
      ...picks.map((row) => [row.name, row.owner, STATUS_LABEL[row.status], row.requests].join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "projects.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${picks.length} ${plural(picks.length)} as CSV.`);
  }

  function togglePause(row: Project) {
    const next: Status = row.status === "paused" ? "live" : "paused";
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)));
    setNotice(`${row.name} is ${STATUS_LABEL[next].toLowerCase()}.`);
  }

  function duplicate(row: Project) {
    copies.current += 1;
    const copy: Project = {
      ...row,
      id: `${row.id}-copy-${copies.current}`,
      name: `${row.name}-copy`,
      status: "paused",
      requests: 0,
    };
    setRows((prev) => prev.flatMap((r) => (r.id === row.id ? [r, copy] : [r])));
    setNotice(`Duplicated ${row.name}.`);
  }

  function sortableHeader(key: SortKey, label: string, className?: string) {
    const on = sort.key === key;
    return (
      <th scope="col" className={className} aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" className="mi-datatable-sort" data-on={on ? "" : undefined} onClick={() => toggleSort(key)}>
          <span>{label}</span>
          {on && sort.dir === "asc" ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
        </button>
      </th>
    );
  }

  return (
    <section className="mi-block mi-block-section mi-datatable">
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Everything deployed from the Acme workspace.</CardDescription>
        </CardHeader>

        {selected.size > 0 ? (
          <div className="mi-datatable-bulk" role="group" aria-label="Actions for the selected projects">
            <p className="mi-datatable-bulk-count">
              <strong>{selected.size}</strong> selected
            </p>
            <div className="mi-block-row">
              <Button onClick={exportSelected}>Export</Button>
              <Button
                variant="danger"
                onClick={() => removeRows([...selected], `Deleted ${selected.size} ${plural(selected.size)}.`)}
              >
                Delete
              </Button>
              <Button variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="mi-datatable-toolbar">
            <TextField
              className="mi-datatable-search"
              type="search"
              aria-label="Search projects and owners"
              placeholder="Search projects and owners"
              icon={<SearchIcon />}
              value={query}
              onChange={(e) => {
                setQuery(e.currentTarget.value);
                setPage(1);
              }}
            />
            <Select
              aria-label="Filter by status"
              options={STATUS_FILTERS}
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
            <Select
              aria-label="Filter by owner"
              options={OWNER_FILTERS}
              value={owner}
              onValueChange={(value) => {
                setOwner(value);
                setPage(1);
              }}
            />
            <Menu>
              <MenuTrigger className="mi-datatable-columns">
                Columns
                <ChevronDownIcon aria-hidden="true" />
              </MenuTrigger>
              <MenuContent placement="bottom-end">
                <MenuLabel>Visible columns</MenuLabel>
                {COLUMNS.map((col) => (
                  <MenuItem
                    key={col.key}
                    icon={<CheckIcon className={shown[col.key] ? undefined : "mi-datatable-unchecked"} />}
                    aria-label={`${col.label} column, ${shown[col.key] ? "shown" : "hidden"}`}
                    // Several columns usually go at once, so keep the menu open.
                    // preventDefault is how MenuItem hands control to a caller.
                    onClick={(e) => {
                      e.preventDefault();
                      toggleColumn(col.key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      toggleColumn(col.key);
                    }}
                  >
                    {col.label}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          </div>
        )}

        {/* A scroll container only reaches the keyboard if it can hold focus. */}
        <div className="mi-datatable-scroll" role="region" aria-label="Projects" tabIndex={0}>
          <table className="mi-datatable-table">
            <caption className="mi-datatable-caption">
              Projects, {filtered.length} of {rows.length} shown, page {current} of {pages}.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="mi-datatable-pick">
                  <Checkbox
                    aria-label="Select every project on this page"
                    disabled={visible.length === 0}
                    checked={allPicked}
                    indeterminate={pickedHere > 0 && !allPicked}
                    onChange={(e) => toggleAllOnPage(e.currentTarget.checked)}
                  />
                </th>
                {sortableHeader("name", "Project")}
                {shown.owner && <th scope="col">Owner</th>}
                {shown.status && <th scope="col">Status</th>}
                {shown.requests && sortableHeader("requests", "Requests", "mi-datatable-figure")}
                <th scope="col" className="mi-datatable-end">
                  <span className="mi-datatable-sr">Row actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td className="mi-datatable-empty" colSpan={columnCount}>
                    <p>No project matches those filters.</p>
                    <Button onClick={clearFilters}>Clear filters</Button>
                  </td>
                </tr>
              )}
              {visible.map((row) => (
                <tr key={row.id} data-selected={selected.has(row.id) ? "" : undefined}>
                  <td className="mi-datatable-pick">
                    <Checkbox
                      aria-label={`Select ${row.name}`}
                      checked={selected.has(row.id)}
                      onChange={(e) => toggleRow(row.id, e.currentTarget.checked)}
                    />
                  </td>
                  <th scope="row" className="mi-datatable-name">
                    {row.name}
                  </th>
                  {shown.owner && <td>{row.owner}</td>}
                  {shown.status && (
                    <td>
                      {/* The dot is drawn in CSS, so a screen reader gets the word and nothing else. */}
                      <span className="mi-datatable-status" data-status={row.status}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </td>
                  )}
                  {shown.requests && <td className="mi-datatable-figure">{grouped(row.requests)}</td>}
                  <td className="mi-datatable-end">
                    <Menu>
                      <MenuTrigger aria-label={`Actions for ${row.name}`} data-variant="ghost" data-size="sm">
                        <MoreIcon />
                      </MenuTrigger>
                      <MenuContent placement="bottom-end">
                        <MenuItem onSelect={() => togglePause(row)}>
                          {row.status === "paused" ? "Resume deploys" : "Pause deploys"}
                        </MenuItem>
                        <MenuItem onSelect={() => duplicate(row)}>Duplicate</MenuItem>
                        <MenuSeparator />
                        <MenuItem variant="danger" onSelect={() => removeRows([row.id], `Deleted ${row.name}.`)}>
                          Delete
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <CardFooter className="mi-datatable-foot">
          <p className="mi-datatable-tally">
            {selected.size > 0
              ? `${selected.size} of ${filtered.length} selected`
              : `${filtered.length} ${plural(filtered.length)}`}
          </p>
          <div className="mi-datatable-pager">
            <span className="mi-datatable-page">
              Page {current} of {pages}
            </span>
            <Button size="sm" disabled={current === 1} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <Button size="sm" disabled={current === pages} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </div>
        </CardFooter>

        {/* Bulk actions land here, because a row leaving the table is easy to miss. */}
        <p className="mi-datatable-live" role="status">
          {notice}
        </p>
      </Card>
    </section>
  );
}
