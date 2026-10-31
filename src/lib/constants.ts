import type { ContributionStatus, Priority, ReportPriority, TicketStatus } from "@prisma/client";

export const TICKET_STATUSES = [
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "BLOCKED",
  "AWAITING_APPROVAL",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly TicketStatus[];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  NEW: "New",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  AWAITING_APPROVAL: "Awaiting approval",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Tailwind classes for status badges. */
export const STATUS_BADGE: Record<TicketStatus, string> = {
  NEW: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
  ASSIGNED: "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  BLOCKED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  AWAITING_APPROVAL: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  ON_HOLD: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100",
  CANCELLED: "bg-neutral-100 text-neutral-500 line-through dark:bg-neutral-800 dark:text-neutral-400",
};

/** Statuses that end a ticket's lifecycle (overdue is never computed for these). */
export const CLOSED_STATUSES: readonly TicketStatus[] = ["COMPLETED", "CANCELLED"];

export const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const satisfies readonly Priority[];

export const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const PRIORITY_BADGE: Record<Priority, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
  MEDIUM: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export const CONTRIBUTION_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
  "BLOCKED",
] as const satisfies readonly ContributionStatus[];

export const CONTRIBUTION_LABELS: Record<ContributionStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  BLOCKED: "Blocked",
};

export const CONTRIBUTION_BADGE: Record<ContributionStatus, string> = {
  NOT_STARTED: STATUS_BADGE.NEW,
  IN_PROGRESS: STATUS_BADGE.IN_PROGRESS,
  DONE: STATUS_BADGE.COMPLETED,
  BLOCKED: STATUS_BADGE.BLOCKED,
};

export const REPORT_PRIORITY_LABELS: Record<ReportPriority, string> = {
  NORMAL: "Normal",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const OVERDUE_BADGE = "bg-red-100 text-red-700 ring-1 ring-red-300 dark:bg-red-950 dark:text-red-200";

/**
 * The 8 departments created by the seed. Seed/reference only — the live list always comes
 * from the `Department` table (departments can be added by admins).
 */
export const SEED_DEPARTMENTS = [
  { code: "EDT", name: "Editorial" },
  { code: "BRD", name: "Broadcasting" },
  { code: "PRD", name: "Product" },
  { code: "MKT", name: "Marketing" },
  { code: "HR", name: "HR" },
  { code: "OPS", name: "Operations" },
  { code: "COM", name: "Communications" },
  { code: "PRO", name: "Production" },
] as const;

/** Banner for a deadline change waiting for approval (matches the AWAITING_APPROVAL badge). */
export const PENDING_BANNER =
  "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100";
