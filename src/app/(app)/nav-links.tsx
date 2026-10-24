"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileChartColumn,
  Gavel,
  House,
  LayoutDashboard,
  Settings,
  Shield,
  Siren,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "/": House,
  "/dashboard": LayoutDashboard,
  "/tickets": Ticket,
  "/daily-report": ClipboardList,
  "/decisions": Gavel,
  "/escalations": Siren,
  "/reports": FileChartColumn,
  "/settings": Settings,
  "/admin": Shield,
};

export function NavLinks({
  items,
  className,
}: {
  items: { href: string; label: string }[];
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <nav className={className}>
      {items.map(({ href, label }) => {
        const Icon = ICONS[href] ?? House;
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              active && "bg-muted font-medium text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
