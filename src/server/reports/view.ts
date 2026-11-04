import type { TicketStatus } from "@prisma/client";
import { assertCan, can, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { resourceInclude, toTicketResource } from "@/server/tickets/detail";
import type { DailyReport, ReportSectionKey } from "@/lib/schemas/daily-report";

const LIST_LIMIT = 200;

/** Reports `user` may view, newest first, every revision. HODs see their own department. */
export async function listDailyReports(user: AuthzUser) {
  assertCan(user, "report.view");
  return prisma.dailyReport.findMany({
    where: user.role === "HOD" ? { departmentId: user.departmentId ?? "" } : {},
    orderBy: [{ reportDate: "desc" }, { revision: "desc" }, { departmentId: "asc" }],
    take: LIST_LIMIT,
    select: {
      id: true,
      reportDate: true,
      submittedAt: true,
      revision: true,
      isLatest: true,
      department: { select: { code: true, name: true } },
      submittedBy: { select: { name: true } },
    },
  });
}

type SnapshotAttachment = { name: string; url?: string };

export type SnapshotRow =
  | { redacted: true; section: ReportSectionKey }
  | {
      redacted: false;
      section: ReportSectionKey;
      ticketNo: string;
      title: string;
      created: boolean;
      status?: TicketStatus;
      progress?: number | null;
      newDueDate?: string;
      note: string;
      reason: string;
      attachments: SnapshotAttachment[];
    };

export type SnapshotDecision =
  | { redacted: true }
  | { redacted: false; ticketNo: string; question: string; impact: string; recommendation: string; deadline: string };

/** Payload rows also come from seeded reports, which predate row keys and carry `ticketId` instead. */
type StoredRow = Partial<DailyReport["items"][number]> & { ticketId?: string; progress?: number | null };

/**
 * One stored report as `user` may see it. The raw payload never leaves this function: a row whose
 * ticket the viewer can't see (or can't be resolved) keeps only its section, and a decision request
 * linked to such a ticket is hidden the same way. Null if unknown; ForbiddenError without `report.view`.
 */
export async function getReportSnapshot(user: AuthzUser, reportId: string) {
  const report = await prisma.dailyReport.findUnique({
    where: { id: reportId },
    include: {
      department: { select: { code: true, name: true } },
      submittedBy: { select: { name: true } },
      items: { include: { ticket: { include: resourceInclude } } },
    },
  });
  if (!report) return null;
  assertCan(user, "report.view", { departmentId: report.departmentId });

  const payload = report.payload as { items?: StoredRow[]; decisionRequests?: DailyReport["decisionRequests"] };
  const itemFor = (row: StoredRow) =>
    report.items.find((i) => (row.key ? i.rowKey === row.key : i.ticketId === row.ticketId));

  const rows = (payload.items ?? []).map((row): SnapshotRow => {
    const section = row.section as ReportSectionKey;
    const item = itemFor(row);
    if (!item || !can(user, "ticket.view", toTicketResource(item.ticket))) return { redacted: true, section };
    return {
      redacted: false,
      section,
      ticketNo: item.ticket.ticketNo,
      title: item.ticket.title,
      created: item.created,
      status: row.mode === "link" ? row.status : undefined,
      progress: row.progress,
      newDueDate: row.mode === "link" ? row.newDueDate : undefined,
      note: row.note ?? "",
      reason: row.reason ?? "",
      attachments: (row.attachments ?? []).map((a) =>
        a.kind === "LINK" ? { name: a.name || a.url, url: a.url } : { name: a.name },
      ),
    };
  });

  const requests = payload.decisionRequests ?? [];
  const linked = await prisma.ticket.findMany({
    where: { ticketNo: { in: requests.map((r) => r.ticketNo.toUpperCase()).filter(Boolean) } },
    include: resourceInclude,
  });
  const decisions = requests.map((r): SnapshotDecision => {
    const ticketNo = r.ticketNo.toUpperCase();
    const ticket = linked.find((t) => t.ticketNo === ticketNo);
    if (ticketNo && (!ticket || !can(user, "ticket.view", toTicketResource(ticket)))) return { redacted: true };
    return {
      redacted: false,
      ticketNo,
      question: r.question,
      impact: r.impact,
      recommendation: r.recommendation,
      deadline: r.deadline,
    };
  });

  return {
    id: report.id,
    department: report.department,
    submittedBy: report.submittedBy.name,
    reportDate: report.reportDate,
    submittedAt: report.submittedAt,
    revision: report.revision,
    isLatest: report.isLatest,
    highestPriority: report.highestPriority,
    blockersText: report.blockersText,
    nextDayPriorities: report.nextDayPriorities,
    rows,
    decisions,
  };
}
