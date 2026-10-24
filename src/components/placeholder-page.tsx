export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">This page is not built yet.</p>
    </div>
  );
}
