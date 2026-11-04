import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtWeekday } from "@/lib/format";
import { navAccess } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth/session";
import { compliancePeriod, getComplianceGrid, type ComplianceStatus } from "@/server/reports/compliance";
import { ReportsTabs } from "../reports-tabs";

const STATUS: Record<ComplianceStatus, { label: string; className: string }> = {
  ON_TIME: { label: "On time", className: "bg-emerald-50 text-emerald-700" },
  LATE: { label: "Late", className: "bg-amber-50 text-amber-700" },
  MISSING: { label: "Missing", className: "bg-red-50 text-red-700" },
  PENDING: { label: "Pending", className: "bg-slate-50 text-slate-700" },
};

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requirePermission(...navAccess("/reports"));
  const { from, to } = await searchParams;
  const period = compliancePeriod(from, to);
  const { days, rows } = await getComplianceGrid(user, period);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-heading-big font-bold text-career-dark">Daily reports</h1>
      <ReportsTabs current="/reports/compliance" />
      <form className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">From</span>
          <Input type="date" name="from" defaultValue={period.from} />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">To</span>
          <Input type="date" name="to" defaultValue={period.to} />
        </label>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>
      {days.length === 0 || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No working days to show for this period.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead>Compliance</TableHead>
              {days.map((day) => (
                <TableHead key={day} className="whitespace-nowrap">
                  {fmtWeekday(new Date(`${day}T00:00:00+05:30`))}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.department.id}>
                <TableCell className="whitespace-nowrap font-semibold text-career-dark">{row.department.name}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {row.rate === null ? "—" : `${row.rate}%`}
                  <span className="text-muted-foreground">
                    {" "}
                    ({row.onTime}/{row.expected})
                  </span>
                </TableCell>
                {row.cells.map((status, i) => (
                  <TableCell key={days[i]} data-day={days[i]} data-dept={row.department.code} data-status={status}>
                    <span
                      className={cn(
                        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs leading-none",
                        STATUS[status].className,
                      )}
                    >
                      {STATUS[status].label}
                    </span>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-xs text-muted-foreground">
        Compliance is reports submitted by the cut-off out of reports expected. For a revised report, the first
        submission decides.
      </p>
    </div>
  );
}
