import { navAccess } from "@/lib/nav";
import { isoDateIST } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { getReportFormData } from "@/server/reports/form";
import { ReportForm } from "./report-form";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const user = await requirePermission(...navAccess("/report"));
  const { dept } = await searchParams;
  const data = await getReportFormData(user, dept);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <h1 className="text-heading-big font-bold text-career-dark">Daily report</h1>
      {data ? (
        <ReportForm {...data} submitterName={user.name} today={isoDateIST(new Date())} />
      ) : (
        <p className="text-sm text-muted-foreground">No active department to report for.</p>
      )}
    </div>
  );
}
