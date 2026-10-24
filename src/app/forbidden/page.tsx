import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">403</p>
      <h1 className="text-2xl font-semibold">Forbidden</h1>
      <p className="max-w-sm text-sm text-muted-foreground">You don&apos;t have permission to view this page.</p>
      <Button asChild variant="outline">
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
