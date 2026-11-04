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
  "/report": ClipboardList,
  "/decisions": Gavel,
  "/escalations": Siren,
  "/reports": FileChartColumn,
  "/settings": Settings,
  "/admin": Shield,
};

const VARIANTS = {
  /** Desktop navy sidebar: cyan text + right border on the active item. */
  sidebar:
    "gap-3 border-r-4 border-transparent px-6 py-3 font-semibold text-white hover:bg-background-hover data-[active=true]:rounded-r-sm data-[active=true]:border-cyan-blue data-[active=true]:bg-background-hover data-[active=true]:text-cyan-blue",
  /** Mobile gradient bar: cyan underline on the active item. */
  bar: "gap-2 border-b-2 border-transparent px-3.5 py-3 font-semibold hover:border-cyan-blue hover:bg-background-hover hover:text-cyan-blue data-[active=true]:border-cyan-blue data-[active=true]:bg-background-hover data-[active=true]:text-cyan-blue",
} as const;

export function NavLinks({
  items,
  variant,
  className,
}: {
  items: { href: string; label: string }[];
  variant: keyof typeof VARIANTS;
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
            data-active={active}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-blue focus-visible:ring-inset",
              VARIANTS[variant],
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
