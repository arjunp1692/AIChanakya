import { PlaceholderPage } from "@/components/placeholder-page";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";

export default async function EscalationsPage() {
  await requirePermission(...navAccess("/escalations"));
  return <PlaceholderPage title="Escalations" />;
}
