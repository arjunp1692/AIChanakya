import { cn } from "@/lib/utils";

/** Section title with the Kubera Now navy/cyan accent bar (docs/DESIGN.md §4). */
export function SectionHeader({
  title,
  as: Tag = "h2",
  className,
  children,
}: {
  title: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
  /** Optional right-aligned actions. */
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative flex min-h-8.25 items-center justify-between gap-3 pl-3", className)}>
      <span
        aria-hidden
        className="absolute top-1/2 left-0 h-5.5 w-1 -translate-y-1/2 rounded-xs bg-primary shadow-[2px_0_0_0_var(--color-cyan-blue)]"
      />
      <Tag className="text-heading-small leading-5.5 font-bold text-career-dark">{title}</Tag>
      {children}
    </div>
  );
}
