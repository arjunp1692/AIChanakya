import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS, TICKET_STATUSES } from "@/lib/constants";
import { navAccess } from "@/lib/nav";
import { parseTicketFilters } from "@/lib/schemas/ticket-filters";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/authz";
import { prisma } from "@/server/db";
import { listTickets } from "@/server/tickets/query";
import { TicketTable } from "./ticket-table";

type SearchParams = Record<string, string | string[] | undefined>;

const selectClass =
  "h-9 w-full rounded-md border border-career-input-border bg-white px-3 text-sm outline-none focus-visible:border-primary-navy focus-visible:ring-2 focus-visible:ring-primary-navy/30";
const labelClass = "text-xs font-semibold text-career-muted";

/** "YYYY-MM-DD" of an instant in IST (for date inputs). */
const istDay = (d?: Date) => (d ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "");

/** Query string of all params except the given ones (repeated params kept). */
function queryWithout(params: SearchParams, drop: string[]): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (drop.includes(k) || v === undefined) continue;
    for (const s of Array.isArray(v) ? v : [v]) if (s !== "") p.append(k, s);
  }
  return p;
}

export default async function TicketsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission(...navAccess("/tickets"));
  const params = await searchParams;
  const f = parseTicketFilters(params);
  const [result, departments, users] = await Promise.all([
    listTickets(user, f),
    prisma.department.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { code: true, name: true } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const filterQuery = queryWithout(params, ["page", "sort", "dir"]).toString();
  const pageHref = (page: number) => {
    const p = queryWithout(params, ["page"]);
    p.set("page", String(page));
    return `/tickets?${p.toString()}`;
  };
  const statusSet = new Set(f.status ?? []);
  const firstRow = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const lastRow = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-heading-big font-bold text-career-dark">Tickets</h1>
        {can(user, "ticket.create") && (
          <Button asChild>
            <Link href="/tickets/new">New ticket</Link>
          </Button>
        )}
      </div>

      <form method="get" action="/tickets" className="space-y-3 rounded-md border border-divider bg-surface p-4">
        <input type="hidden" name="sort" value={f.sort} />
        <input type="hidden" name="dir" value={f.dir} />
        {f.ids && <input type="hidden" name="ids" value={f.ids.join(",")} />}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="q" className={labelClass}>
              Search (ticket ID or title)
            </label>
            <Input id="q" name="q" defaultValue={f.q ?? ""} placeholder="KN-EDT-2026-00001 or title…" />
          </div>
          <div className="space-y-1">
            <label htmlFor="dept" className={labelClass}>
              Department
            </label>
            <select id="dept" name="dept" defaultValue={f.dept?.[0] ?? ""} className={selectClass}>
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.code} — {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="priority" className={labelClass}>
              Priority
            </label>
            <select id="priority" name="priority" defaultValue={f.priority?.[0] ?? ""} className={selectClass}>
              <option value="">All</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="owner" className={labelClass}>
              Owner
            </label>
            <select id="owner" name="owner" defaultValue={f.owner ?? ""} className={selectClass}>
              <option value="">Anyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="assignee" className={labelClass}>
              Co-assignee
            </label>
            <select id="assignee" name="assignee" defaultValue={f.assignee ?? ""} className={selectClass}>
              <option value="">Anyone</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <span className={labelClass}>Created between</span>
            <div className="flex gap-1">
              <Input type="date" name="createdFrom" aria-label="Created from" defaultValue={istDay(f.createdFrom)} />
              <Input type="date" name="createdTo" aria-label="Created to" defaultValue={istDay(f.createdTo)} />
            </div>
          </div>
          <div className="space-y-1">
            <span className={labelClass}>Completed between</span>
            <div className="flex gap-1">
              <Input type="date" name="completedFrom" aria-label="Completed from" defaultValue={istDay(f.completedFrom)} />
              <Input type="date" name="completedTo" aria-label="Completed to" defaultValue={istDay(f.completedTo)} />
            </div>
          </div>
        </div>
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <legend className={`${labelClass} mb-1`}>Status</legend>
          {TICKET_STATUSES.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="status" value={s} defaultChecked={statusSet.has(s)} />
              {STATUS_LABELS[s]}
            </label>
          ))}
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <input type="checkbox" name="overdue" value="1" defaultChecked={f.overdue} />
            Overdue only
          </label>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit">Apply</Button>
          <Button variant="outline" asChild>
            <Link href="/tickets">Reset</Link>
          </Button>
          {f.ids && (
            <span className="text-sm text-career-muted">
              Limited to {f.ids.length} selected ticket{f.ids.length === 1 ? "" : "s"} ·{" "}
              <Link href={`/tickets?${queryWithout(params, ["ids", "page"]).toString()}`} className="text-content-link underline underline-offset-2">
                show all
              </Link>
            </span>
          )}
        </div>
      </form>

      <div className="overflow-hidden rounded-md border border-divider bg-surface">
        <TicketTable rows={result.rows} sort={f.sort} dir={f.dir} query={filterQuery} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-career-muted">
        <span>
          {firstRow}–{lastRow} of {result.total}
        </span>
        <div className="flex gap-2">
          {result.page > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(result.page - 1)}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          <span className="self-center">
            Page {result.page} of {result.pageCount}
          </span>
          {result.page < result.pageCount ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={pageHref(result.page + 1)}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
