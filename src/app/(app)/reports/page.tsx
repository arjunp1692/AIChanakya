import { PlaceholderPage } from "@/components/placeholder-page";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";

export default async function ReportsPage() {
  await requirePermission(...navAccess("/reports"));
  return <PlaceholderPage title="Reports" />;
}
