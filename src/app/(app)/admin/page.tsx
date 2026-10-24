import { PlaceholderPage } from "@/components/placeholder-page";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";

export default async function AdminPage() {
  await requirePermission(...navAccess("/admin"));
  return <PlaceholderPage title="Admin" />;
}
