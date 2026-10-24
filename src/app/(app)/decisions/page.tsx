import { PlaceholderPage } from "@/components/placeholder-page";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";

export default async function DecisionsPage() {
  await requirePermission(...navAccess("/decisions"));
  return <PlaceholderPage title="Decisions" />;
}
