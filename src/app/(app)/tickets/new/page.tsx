import { prisma } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { confidentialDefaultDepts } from "@/server/tickets/service";
import { NewTicketForm } from "./new-ticket-form";

export default async function NewTicketPage() {
  const user = await requirePermission("ticket.create");
  const anyDept = user.role === "CEO" || user.role === "CEO_OFFICE";

  const departments = await prisma.department.findMany({
    where: { active: true, ...(anyDept ? {} : { id: user.departmentId ?? "" }) },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
  const users = await prisma.user.findMany({
    where: {
      active: true,
      departmentId: { in: departments.map((d) => d.id) },
      ...(user.role === "MEMBER" ? { id: user.id } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, departmentId: true },
  });
  const confidentialDepts = await confidentialDefaultDepts();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">New ticket</h1>
      <NewTicketForm
        departments={departments}
        users={users}
        confidentialDepts={confidentialDepts}
        currentUserId={user.id}
      />
    </div>
  );
}
