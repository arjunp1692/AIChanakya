import type { TicketStatus } from "@prisma/client";
import { REPORT_MAX_ROWS, type ReportSectionKey } from "@/lib/schemas/daily-report";
import { isOverdue } from "@/lib/ticket-utils";

type CarriedTicket = { ticketNo: string; status: TicketStatus; dueDate: string | null; blockerReason: string | null };

function carrySection(t: CarriedTicket, endOfDay: Date): ReportSectionKey {
  if (isOverdue({ status: t.status, dueDate: t.dueDate ? new Date(t.dueDate) : null }, endOfDay)) return "DELAYED";
  if (t.status === "BLOCKED") return "BLOCKED";
  return t.status === "IN_PROGRESS" ? "IN_PROGRESS" : "PENDING";
}

/**
 * Form rows for the open tickets a report on `reportDate` starts with, overdue first so they survive
 * the row cap. Status, progress and due date stay blank ("unchanged"), so an untouched row changes
 * nothing on its ticket. A delay reason is never pre-filled: it becomes a ticket comment.
 */
export function carryForwardRows(tickets: CarriedTicket[], reportDate: string, newKey: () => string) {
  const endOfDay = new Date(`${reportDate}T23:59:59+05:30`);
  return tickets
    .map((t) => {
      const section = carrySection(t, endOfDay);
      return {
        key: newKey(),
        mode: "link" as const,
        ticketNo: t.ticketNo,
        section,
        note: "",
        reason: section === "BLOCKED" ? (t.blockerReason ?? "").slice(0, 1000) : "",
        attachments: [],
        newDueDate: "",
      };
    })
    .sort((a, b) => Number(b.section === "DELAYED") - Number(a.section === "DELAYED"))
    .slice(0, REPORT_MAX_ROWS);
}
