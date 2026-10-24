import type { Action } from "@/server/authz";

export type NavItem = {
  href: string;
  label: string;
  /** Shown when the user may perform any of these. */
  actions: Action[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", actions: ["dashboard.ceo"] },
  { href: "/tickets", label: "Tickets", actions: ["ticket.view"] },
  { href: "/daily-report", label: "Daily Report", actions: ["report.submit"] },
  { href: "/decisions", label: "Decisions", actions: ["decision.request", "decision.decide"] },
  { href: "/escalations", label: "Escalations", actions: ["escalation.view"] },
  { href: "/reports", label: "Reports", actions: ["report.view"] },
  { href: "/settings", label: "Settings", actions: ["settings.manage"] },
  { href: "/admin", label: "Admin", actions: ["admin.users", "admin.departments"] },
];

export function navAccess(href: string): Action[] {
  const item = NAV_ITEMS.find((i) => i.href === href);
  if (!item) throw new Error(`Unknown nav route ${href}`);
  return item.actions;
}
