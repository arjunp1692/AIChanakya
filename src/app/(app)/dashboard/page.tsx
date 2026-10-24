import { PlaceholderPage } from "@/components/placeholder-page";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";

export default async function DashboardPage() {
  await requirePermission(...navAccess("/dashboard"));
  return <PlaceholderPage title="CEO Command Centre" />;
}
