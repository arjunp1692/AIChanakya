import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Chanakya AI</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          CEO Office task and ticket system for Kubera Now.
        </CardContent>
      </Card>
    </main>
  );
}
