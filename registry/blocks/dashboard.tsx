import { MoreIcon } from "../icons/more";
import { SearchIcon } from "../icons/search";
import { Button } from "../ui/button";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../ui/menu";
import { Select } from "../ui/select";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "../ui/tabs";
import { TextField } from "../ui/text-field";
import "./blocks.css";

const NAV = ["Overview", "Projects", "Analytics", "Settings"];

const STATS = [
  { label: "Visitors", value: "24,318", delta: "+12.4%" },
  { label: "Installs", value: "1,204", delta: "+3.1%" },
  { label: "Churn", value: "0.8%", delta: "-0.2%", down: true },
];

const ROWS = [
  { name: "mitame.dev", visits: "12,904", share: 72 },
  { name: "docs", visits: "6,411", share: 46 },
  { name: "blocks", visits: "3,220", share: 28 },
  { name: "themes", visits: "1,783", share: 16 },
];

/** Sidebar, filters, stat tiles and a table. No charting dependency. */
export default function Dashboard() {
  return (
    <div className="mi-block mi-dash">
      <aside className="mi-dash-side">
        <div className="mi-block-row">
          <span className="mi-auth-mark" aria-hidden="true">m</span>
          <strong>Acme</strong>
        </div>
        <nav className="mi-dash-nav" aria-label="Sections">
          {NAV.map((item, i) => (
            <a key={item} href={`#${item.toLowerCase()}`} aria-current={i === 0 ? "page" : undefined}>
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <main className="mi-dash-main">
        <header className="mi-block-between">
          <div>
            <h1 className="mi-block-title" style={{ fontSize: "var(--mi-text-xl)" }}>Overview</h1>
            <p className="mi-block-muted mi-block-small" style={{ margin: "4px 0 0" }}>Last 30 days</p>
          </div>
          <div className="mi-block-row">
            <TextField aria-label="Search" placeholder="Search" icon={<SearchIcon />} />
            <Select
              aria-label="Range"
              defaultValue="30d"
              options={[
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" },
                { value: "12m", label: "Last 12 months" },
              ]}
            />
            <Menu>
              <MenuTrigger aria-label="Actions">
                <MoreIcon />
              </MenuTrigger>
              <MenuContent>
                <MenuItem onSelect={() => {}}>Export CSV</MenuItem>
                <MenuItem onSelect={() => {}}>Share report</MenuItem>
                <MenuSeparator />
                <MenuItem variant="danger" onSelect={() => {}}>Reset data</MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </header>

        <div className="mi-dash-stats">
          {STATS.map((stat) => (
            <Card key={stat.label}>
              <CardBody>
                <p className="mi-block-muted mi-block-small" style={{ margin: 0 }}>{stat.label}</p>
                <p className="mi-dash-stat-value" style={{ margin: "6px 0 2px" }}>{stat.value}</p>
                <span className="mi-dash-delta" data-down={stat.down ? "" : undefined}>{stat.delta}</span>
              </CardBody>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pages</CardTitle>
            <CardDescription>Where people landed this month.</CardDescription>
          </CardHeader>
          <Tabs defaultValue="all">
            <TabsList aria-label="Filter">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="new">New</TabsTrigger>
              <TabsTrigger value="returning">Returning</TabsTrigger>
            </TabsList>
            <TabsPanel value="all">
              <CardBody>
                <table className="mi-dash-table">
                  <thead>
                    <tr>
                      <th scope="col">Page</th>
                      <th scope="col">Visits</th>
                      <th scope="col">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row) => (
                      <tr key={row.name}>
                        <td>{row.name}</td>
                        <td>{row.visits}</td>
                        <td>
                          <div className="mi-dash-bar" role="img" aria-label={`${row.share} percent`}>
                            <span style={{ width: `${row.share}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </TabsPanel>
            <TabsPanel value="new">
              <CardBody className="mi-block-muted mi-block-small">First time visitors only.</CardBody>
            </TabsPanel>
            <TabsPanel value="returning">
              <CardBody className="mi-block-muted mi-block-small">People who came back.</CardBody>
            </TabsPanel>
          </Tabs>
          <CardBody>
            <Button variant="primary">Export report</Button>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
