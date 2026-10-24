// Prints seed counts and asserts S02 acceptance criteria 2–3. Run: pnpm seed:check
import { PrismaClient, Priority, TicketStatus } from "@prisma/client";

const prisma = new PrismaClient();
const CLOSED: TicketStatus[] = ["COMPLETED", "CANCELLED"];

async function main() {
  const tickets = await prisma.ticket.findMany({
    include: { department: true, assignees: { include: { user: true } } },
  });
  const now = new Date();
  const tally = (key: (t: (typeof tickets)[number]) => string) =>
    tickets.reduce<Record<string, number>>((acc, t) => ((acc[key(t)] = (acc[key(t)] ?? 0) + 1), acc), {});

  console.log("by status:    ", tally((t) => t.status));
  console.log("by priority:  ", tally((t) => t.priority));
  console.log("by department:", tally((t) => t.department.code));

  const undatedWithoutReason = tickets.filter((t) => !t.dueDate && !t.noDeadlineReason);
  const overdue = tickets.filter((t) => t.dueDate && t.dueDate < now && !CLOSED.includes(t.status));
  const extended = tickets.filter((t) => t.extensionCount >= 2);
  const crossDept = tickets.filter((t) => t.assignees.some((a) => a.user.departmentId !== t.departmentId));
  const missingStatus = Object.values(TicketStatus).filter((s) => !tickets.some((t) => t.status === s));
  const missingPriority = Object.values(Priority).filter((p) => !tickets.some((t) => t.priority === p));

  console.log(
    `overdue=${overdue.length} extended(>=2)=${extended.length} crossDeptCoAssignees=${crossDept.length}`,
  );

  const failures = [
    // ownerId is a required column, so every ticket has an owner by construction.
    undatedWithoutReason.length && `tickets without dueDate or noDeadlineReason: ${undatedWithoutReason.map((t) => t.ticketNo)}`,
    missingStatus.length && `statuses not covered: ${missingStatus}`,
    missingPriority.length && `priorities not covered: ${missingPriority}`,
    overdue.length < 3 && `overdue < 3 (${overdue.length})`,
    extended.length < 2 && `extensionCount>=2 < 2 (${extended.length})`,
    crossDept.length < 3 && `cross-dept co-assignee tickets < 3 (${crossDept.length})`,
  ].filter(Boolean);

  if (failures.length) {
    console.error("FAIL\n- " + failures.join("\n- "));
    process.exit(1);
  }
  console.log("PASS");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
