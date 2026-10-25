import Link from "next/link";
import { PlaceholderPage } from "@/components/placeholder-page";
import { Button } from "@/components/ui/button";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/authz";

export default async function TicketsPage() {
  const user = await requirePermission(...navAccess("/tickets"));
  return (
    <div className="space-y-4">
      {can(user, "ticket.create") && (
        <Button asChild>
          <Link href="/tickets/new">New ticket</Link>
        </Button>
      )}
      <PlaceholderPage title="Tickets" />
    </div>
  );
}
