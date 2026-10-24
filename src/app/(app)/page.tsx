import { requireUser } from "@/server/auth/session";

export default async function Home() {
  const user = await requireUser();

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Welcome, {user.name}</h1>
      <p className="text-sm text-muted-foreground">Use the navigation to get to your work.</p>
    </div>
  );
}
