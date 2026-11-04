import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SectionHeader } from "@/components/section-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { REPORT_PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { navAccess } from "@/lib/nav";
import { REPORT_SECTIONS, REPORT_SECTION_LABELS } from "@/lib/schemas/daily-report";
import { requirePermission } from "@/server/auth/session";
import { ForbiddenError } from "@/server/authz";
import { getReportSnapshot, type SnapshotRow } from "@/server/reports/view";

const CONFIDENTIAL = "Confidential item";

function Row({ row }: { row: SnapshotRow }) {
  if (row.redacted) return <li className="text-muted-foreground italic">{CONFIDENTIAL}</li>;
  const facts = [
    row.created && "New ticket",
    row.status && STATUS_LABELS[row.status],
    row.progress != null && `${row.progress}%`,
    row.newDueDate && `New due date ${row.newDueDate}`,
  ].filter(Boolean);
  return (
    <li className="space-y-0.5">
      <p>
        <Link href={`/tickets/${row.ticketNo}`} className="font-mono text-xs text-career-muted hover:text-primary">
          {row.ticketNo}
        </Link>{" "}
        <span className="font-medium">{row.title}</span>
      </p>
      {facts.length > 0 && <p className="text-muted-foreground">{facts.join(" · ")}</p>}
      {row.note && <p>{row.note}</p>}
      {row.reason && <p className="text-muted-foreground">Reason: {row.reason}</p>}
      {row.attachments.length > 0 && (
        <p className="text-muted-foreground">
          Attachments:{" "}
          {row.attachments.map((a, i) => (
            <span key={i}>
              {i > 0 && ", "}
              {a.url ? (
                <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {a.name}
                </a>
              ) : (
                a.name
              )}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}

export default async function ReportSnapshotPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <Link href="/reports/daily" className="text-sm text-primary hover:underline">
          ← Daily reports
        </Link>
        <h1 className="text-heading-big font-bold text-career-dark">
          {report.department.name} · {fmtDate(report.reportDate)}
        </h1>
        <p className="text-sm text-muted-foreground">
          Revision {report.revision}
          {!report.isLatest && " (superseded)"} · submitted by {report.submittedBy} on {fmtDateTime(report.submittedAt)} ·
          highest priority {REPORT_PRIORITY_LABELS[report.highestPriority]}
        </p>
      </div>

      {REPORT_SECTIONS.map((section) => {
        const rows = report.rows.filter((r) => r.section === section);
        if (!rows.length) return null;
        return (
          <Card key={section}>
            <CardHeader>
              <SectionHeader title={`${REPORT_SECTION_LABELS[section]} (${rows.length})`} />
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {rows.map((row, i) => (
                  <Row key={i} row={row} />
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      {(report.blockersText || report.nextDayPriorities) && (
        <Card>
          <CardContent className="space-y-3 text-sm">
            {report.blockersText && (
              <p className="whitespace-pre-wrap">
                <span className="font-medium">Blockers: </span>
                {report.blockersText}
              </p>
            )}
            {report.nextDayPriorities && (
              <p className="whitespace-pre-wrap">
                <span className="font-medium">Next-day priorities: </span>
                {report.nextDayPriorities}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {report.decisions.length > 0 && (
        <Card>
          <CardHeader>
            <SectionHeader title="CEO decision requests" />
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm">
              {report.decisions.map((d, i) =>
                d.redacted ? (
                  <li key={i} className="text-muted-foreground italic">
                    {CONFIDENTIAL}
                  </li>
                ) : (
                  <li key={i} className="space-y-0.5">
                    <p className="font-medium">{d.question}</p>
                    {d.ticketNo && <p className="font-mono text-xs text-career-muted">{d.ticketNo}</p>}
                    {d.impact && <p>Impact: {d.impact}</p>}
                    {d.recommendation && <p>Recommendation: {d.recommendation}</p>}
                    {d.deadline && <p className="text-muted-foreground">Needed by {d.deadline}</p>}
                  </li>
                ),
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
