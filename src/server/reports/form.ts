import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { assertCan, ticketVisibilityWhere, type AuthzUser } from "@/server/authz";
import { CLOSED_STATUSES } from "@/lib/constants";
import type { DailyReport } from "@/lib/schemas/daily-report";

/** Recent days offered for resubmission (the form's date picker can go back further, as a fresh report). */
const RESUBMIT_DAYS = 14;

/** Tickets a department reports on: its own, plus any its people own or co-work on. */
export const deptTicketWhere = (departmentId: string): Prisma.TicketWhereInput => ({
  OR: [{ departmentId }, { owner: { departmentId } }, { assignees: { some: { user: { departmentId } } } }],
});

/**
 * Data for the daily report form. HODs report for their own department; CEO/CEO_OFFICE may
 * pick any active department (`deptCode`, default first by name).
 */
export async function getReportFormData(user: AuthzUser, deptCode?: string) {
  const anyDept = user.role === "CEO" || user.role === "CEO_OFFICE";
  const departments = await prisma.department.findMany({
    where: { active: true, ...(anyDept ? {} : { id: user.departmentId ?? "" }) },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
  const department = departments.find((d) => d.code === deptCode) ?? departments[0];
  if (!department) return null;
  assertCan(user, "report.submit", { departmentId: department.id });

  const select = {
    ticketNo: true,
    title: true,
    status: true,
    progress: true,
    dueDate: true,
    originalDueDate: true,
    blockerReason: true,
  } as const;
  const open = { AND: [ticketVisibilityWhere(user), { status: { notIn: [...CLOSED_STATUSES] } }] };
  const ofDept = deptTicketWhere(department.id);
  const [deptTickets, otherTickets, users, reports] = await Promise.all([
    // Own-dept tickets can be linked; any visible open ticket can be a dependency of a new row.
    prisma.ticket.findMany({
      where: { ...open, ...ofDept },
      orderBy: { updatedAt: "desc" },
      select,
    }),
    prisma.ticket.findMany({
      where: { ...open, NOT: ofDept },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select,
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, departmentId: true, department: { select: { code: true } } },
    }),
    prisma.dailyReport.findMany({
      where: { departmentId: department.id, isLatest: true },
      orderBy: { reportDate: "desc" },
      take: RESUBMIT_DAYS,
      select: { reportDate: true, revision: true, payload: true },
    }),
  ]);

  return {
    departments,
    department,
    tickets: [
      ...deptTickets.map((t) => ({ ...t, ownDept: true })),
      ...otherTickets.map((t) => ({ ...t, ownDept: false })),
    ].map((t) => ({
      ...t,
      dueDate: t.dueDate?.toISOString() ?? null,
      originalDueDate: t.originalDueDate?.toISOString() ?? null,
    })),
    /** Latest revision per day. Rows keep their keys, so a resubmission only applies what changed. */
    submitted: reports.flatMap((r) => {
      const payload = r.payload as unknown as DailyReport;
      // Seeded reports predate row keys and can't be edited in the form.
      if (!payload.items?.every((row) => row.key)) return [];
      return [{ reportDate: r.reportDate.toISOString().slice(0, 10), revision: r.revision, payload }];
    }),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      departmentId: u.departmentId,
      deptCode: u.department?.code ?? null,
    })),
  };
}

export type ReportFormData = NonNullable<Awaited<ReturnType<typeof getReportFormData>>>;
