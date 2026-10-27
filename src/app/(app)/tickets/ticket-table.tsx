"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { OVERDUE_BADGE, PRIORITY_BADGE, PRIORITY_LABELS, STATUS_BADGE, STATUS_LABELS } from "@/lib/constants";
import type { TicketSortKey } from "@/lib/schemas/ticket-filters";
import type { TicketListRow } from "@/server/tickets/query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });
const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
const badge = "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";

const col = createColumnHelper<TicketListRow>();

// Column ids double as server sort keys.
const columns = [
  col.accessor("ticketNo", {
    id: "ticketNo",
    header: "ID",
    cell: (c) => (
      <Link href={`/tickets/${c.getValue()}`} className="font-mono text-xs text-career-muted transition-colors hover:text-primary hover:underline">
        {c.getValue()}
      </Link>
    ),
  }),
  col.accessor("title", {
    id: "title",
    header: "Title",
    cell: (c) => (
      <Link href={`/tickets/${c.row.original.ticketNo}`} className="font-semibold text-career-dark transition-colors hover:text-primary">
        {c.getValue()}
        {c.row.original.confidential && <span className="ml-1 text-xs font-normal text-career-muted">(confidential)</span>}
      </Link>
    ),
  }),
  col.accessor((r) => r.department.code, {
    id: "department",
    header: "Dept",
    cell: (c) => <Badge variant="chip">{c.getValue()}</Badge>,
  }),
  col.accessor((r) => r.owner.name, { id: "owner", header: "Owner" }),
  col.accessor("priority", {
    id: "priority",
    header: "Priority",
    cell: (c) => <span className={cn(badge, PRIORITY_BADGE[c.getValue()])}>{PRIORITY_LABELS[c.getValue()]}</span>,
  }),
  col.accessor("status", {
    id: "status",
    header: "Status",
    cell: (c) => <span className={cn(badge, STATUS_BADGE[c.getValue()])}>{STATUS_LABELS[c.getValue()]}</span>,
  }),
  col.accessor("progress", { id: "progress", header: "Progress", cell: (c) => `${c.getValue()}%` }),
  col.accessor("dueDate", {
    id: "dueDate",
    header: "Due",
    cell: (c) => {
      const due = c.getValue();
      return (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          {due ? fmtDate(due) : <span className="text-muted-foreground">—</span>}
          {c.row.original.overdue && <span className={cn(badge, OVERDUE_BADGE)}>Overdue</span>}
        </span>
      );
    },
  }),
  col.accessor("updatedAt", {
    id: "updatedAt",
    header: "Last updated",
    cell: (c) => <span className="whitespace-nowrap">{fmtDateTime(c.getValue())}</span>,
  }),
];

export function TicketTable({
  rows,
  sort,
  dir,
  query,
}: {
  rows: TicketListRow[];
  sort: TicketSortKey;
  dir: "asc" | "desc";
  /** Current filter query string, without page/sort/dir. */
  query: string;
}) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  const sortHref = (key: string) => {
    const p = new URLSearchParams(query);
    p.set("sort", key);
    p.set("dir", sort === key && dir === "asc" ? "desc" : "asc");
    return `/tickets?${p.toString()}`;
  };

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead key={h.id}>
                <Link href={sortHref(h.column.id)} className="inline-flex items-center gap-1 rounded-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-primary-navy/40">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {sort === h.column.id && <span aria-hidden>{dir === "asc" ? "▲" : "▼"}</span>}
                </Link>
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
              No tickets match these filters.
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
