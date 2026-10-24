import { PlaceholderPage } from "@/components/placeholder-page";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";

export default async function DailyReportPage() {
  await requirePermission(...navAccess("/daily-report"));
  return <PlaceholderPage title="Daily Report" />;
}
