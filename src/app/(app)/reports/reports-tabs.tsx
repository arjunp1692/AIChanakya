import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/reports/daily", label: "Daily reports" },
  { href: "/reports/compliance", label: "Compliance" },
];

export function ReportsTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Reports" className="flex gap-4 border-b border-divider">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-1 pb-2 text-sm font-medium",
            tab.href === current
              ? "border-primary text-career-dark"
              : "border-transparent text-muted-foreground hover:text-career-dark",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
