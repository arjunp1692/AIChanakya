import { PlaceholderPage } from "@/components/placeholder-page";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";

export default async function SettingsPage() {
  await requirePermission(...navAccess("/settings"));
  return <PlaceholderPage title="Settings" />;
}
