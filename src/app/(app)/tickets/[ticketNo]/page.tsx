import { notFound } from "next/navigation";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { requireUser } from "@/server/auth/session";
import { ticketVisibilityWhere } from "@/server/authz";
import { prisma } from "@/server/db";

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });

// Minimal landing page after creation; the full detail view is S08.
export default async function TicketPage({ params }: { params: Promise<{ ticketNo: string }> }) {
  const { ticketNo } = await params;
  const user = await requireUser();
  const ticket = await prisma.ticket.findFirst({
    where: { AND: [{ ticketNo }, ticketVisibilityWhere(user)] },
    include: { department: true, owner: true },
  });
  if (!ticket) notFound();

  return (
    <div className="space-y-2">
      <p className="font-mono text-sm text-muted-foreground">{ticket.ticketNo}</p>
      <h1 className="text-xl font-semibold">{ticket.title}</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Department</dt>
        <dd>{ticket.department.name}</dd>
        <dt className="text-muted-foreground">Owner</dt>
        <dd>{ticket.owner.name}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd>{STATUS_LABELS[ticket.status]}</dd>
        <dt className="text-muted-foreground">Priority</dt>
        <dd>{PRIORITY_LABELS[ticket.priority]}</dd>
        <dt className="text-muted-foreground">Due</dt>
        <dd>{ticket.dueDate ? fmt(ticket.dueDate) : `No deadline: ${ticket.noDeadlineReason}`}</dd>
        <dt className="text-muted-foreground">Confidential</dt>
        <dd>{ticket.confidential ? "Yes" : "No"}</dd>
      </dl>
      {ticket.description && <p className="whitespace-pre-wrap pt-2 text-sm">{ticket.description}</p>}
    </div>
  );
}
