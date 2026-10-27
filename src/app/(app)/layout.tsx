import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/nav";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz";
import { prisma } from "@/server/db";
import { logout } from "../login/actions";
import { NavLinks } from "./nav-links";

const ROLE_LABELS = {
  CEO: "CEO",
  CEO_OFFICE: "CEO Office",
  HOD: "Head of Department",
  MEMBER: "Member",
  VIEWER: "Viewer",
} as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const department = user.departmentId
    ? await prisma.department.findUnique({ where: { id: user.departmentId }, select: { name: true } })
    : null;

  const items = [
    { href: "/", label: "Home" },
    ...NAV_ITEMS.filter((i) => i.actions.some((a) => can(user, a))).map(({ href, label }) => ({ href, label })),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col bg-dark-navy1 text-white md:flex">
        <div className="border-b border-indigo-dark px-6 py-4">
          <div className="text-base font-bold">Chanakya AI</div>
          <div className="text-xs uppercase tracking-wider text-cyan-blue">Kubera Now · CEO Office</div>
        </div>
        <NavLinks items={items} variant="sidebar" className="flex flex-col py-3" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-divider bg-surface px-4 py-3 shadow-sm md:px-6">
          <span className="font-bold text-primary md:hidden">Chanakya AI</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <div className="font-semibold text-career-dark">{user.name}</div>
              <div className="text-xs text-career-muted">
                {ROLE_LABELS[user.role]}
                {department ? ` · ${department.name}` : ""}
              </div>
            </div>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Log out">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </header>
        <NavLinks
          items={items}
          variant="bar"
          className="flex overflow-x-auto border-b border-cyan-blue bg-linear-to-r from-dark-navy2 to-primary-navy text-white md:hidden"
        />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 md:px-6 md:py-6">{children}</main>
      </div>
    </div>
  );
}
