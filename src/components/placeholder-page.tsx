export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-heading-big font-bold text-career-dark">{title}</h1>
      <p className="text-sm text-career-muted">This page is not built yet.</p>
    </div>
  );
}
