import type { TicketStatus } from "@prisma/client";
import { CLOSED_STATUSES } from "@/lib/constants";

/** Open = not COMPLETED/CANCELLED. Progress updates and overdue only apply to open tickets. */
export function isOpenStatus(status: TicketStatus): boolean {
  return !CLOSED_STATUSES.includes(status);
}

/**
 * Overdue is computed, never stored: an open ticket whose due date has passed.
 * The single source for overdue checks; SQL filters mirror it in `overdueWhere`.
 */
export function isOverdue(t: { status: TicketStatus; dueDate: Date | null }, now = new Date()): boolean {
  return !!t.dueDate && t.dueDate < now && isOpenStatus(t.status);
}
