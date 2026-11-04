import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";
import { listDailyReports } from "@/server/reports/view";
import { ReportsTabs } from "../reports-tabs";

export default async function DailyReportsPage() {
  const user = await requirePermission(...navAccess("/reports"));
  const reports = await listDailyReports(user);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-heading-big font-bold text-career-dark">Daily reports</h1>
      <ReportsTabs current="/reports/daily" />
      {reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports submitted yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Submitted by</TableHead>
              <TableHead>Submitted at</TableHead>
              <TableHead>Revision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/reports/daily/${r.id}`} className="font-semibold text-career-dark hover:text-primary">
                    {fmtDate(r.reportDate)}
                  </Link>
                </TableCell>
                <TableCell>{r.department.name}</TableCell>
                <TableCell>{r.submittedBy.name}</TableCell>
                <TableCell>{fmtDateTime(r.submittedAt)}</TableCell>
                <TableCell>
                  {r.revision}
                  {!r.isLatest && <span className="text-muted-foreground"> (superseded)</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
