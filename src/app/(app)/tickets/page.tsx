import { PlaceholderPage } from "@/components/placeholder-page";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";

export default async function TicketsPage() {
  await requirePermission(...navAccess("/tickets"));
  return <PlaceholderPage title="Tickets" />;
}
