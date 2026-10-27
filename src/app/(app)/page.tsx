import { AiBadge } from "@/components/ai-badge";
import { requireUser } from "@/server/auth/session";

export default async function Home() {
  const user = await requireUser();

  return (
    <div className="space-y-2">
      <h1 className="text-heading-big font-bold text-career-dark">Welcome, {user.name}</h1>
      <p className="text-sm text-career-muted">Use the navigation to get to your work.</p>
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-career-muted">
        Content marked <AiBadge /> is drafted by Chanakya AI and cites its source tickets.
      </p>
    </div>
  );
}
