import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/format";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";
import { ForbiddenError } from "@/server/authz";
import { getReportSnapshot } from "@/server/reports/view";

function TicketList({ title, tickets }: { title: string; tickets: { ticketNo: string; title: string }[] }) {
  return (
    <section className="space-y-1 rounded-md border border-divider bg-surface p-4 text-sm">
      <h2 className="text-base font-semibold text-career-dark">
        {title} ({tickets.length})
      </h2>
      {tickets.length === 0 ? (
        <p className="text-muted-foreground">None</p>
      ) : (
        <ul className="space-y-1">
          {tickets.map((t) => (
            <li key={t.ticketNo}>
              <Link href={`/tickets/${t.ticketNo}`} className="font-mono text-xs text-primary hover:underline">
                {t.ticketNo}
              </Link>{" "}
              {t.title}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function ReportSubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(...navAccess("/reports"));
  const { id } = await params;
  let report;
  try {
    report = await getReportSnapshot(user, id);
  } catch (err) {
    if (err instanceof ForbiddenError) redirect("/forbidden");
    throw err;
  }
  if (!report) notFound();

  const rows = report.rows.flatMap((r) => (r.redacted ? [] : [r]));
  const unique = (list: typeof rows) => [...new Map(list.map((r) => [r.ticketNo, r])).values()];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-heading-big font-bold text-career-dark">Report submitted</h1>
        <p className="text-sm text-muted-foreground">
          {report.department.name} · {fmtDate(report.reportDate)} · revision {report.revision}
        </p>
      </div>
      <TicketList title="Tickets created" tickets={unique(rows.filter((r) => r.created))} />
      <TicketList title="Tickets updated" tickets={unique(rows.filter((r) => !r.created))} />
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/reports/daily/${report.id}`}>View report</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/reports/daily">All reports</Link>
        </Button>
      </div>
    </div>
  );
}
