import { prisma } from "@/server/db";
import { assertCan, ticketVisibilityWhere, type AuthzUser } from "@/server/authz";
import { CLOSED_STATUSES } from "@/lib/constants";

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

  const select = { ticketNo: true, title: true, status: true, progress: true, dueDate: true } as const;
  const open = { AND: [ticketVisibilityWhere(user), { status: { notIn: [...CLOSED_STATUSES] } }] };
  const [deptTickets, otherTickets, users] = await Promise.all([
    // Own-dept tickets can be linked; any visible open ticket can be a dependency of a new row.
    prisma.ticket.findMany({
      where: { ...open, departmentId: department.id },
      orderBy: { updatedAt: "desc" },
      select,
    }),
    prisma.ticket.findMany({
      where: { ...open, departmentId: { not: department.id } },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select,
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, departmentId: true, department: { select: { code: true } } },
    }),
  ]);

  return {
    departments,
    department,
    tickets: [
      ...deptTickets.map((t) => ({ ...t, ownDept: true })),
      ...otherTickets.map((t) => ({ ...t, ownDept: false })),
    ].map((t) => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      departmentId: u.departmentId,
      deptCode: u.department?.code ?? null,
    })),
  };
}

export type ReportFormData = NonNullable<Awaited<ReturnType<typeof getReportFormData>>>;
