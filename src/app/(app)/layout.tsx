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
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-background md:flex">
        <div className="px-5 py-4 text-base font-semibold">Chanakya AI</div>
        <NavLinks items={items} className="flex flex-col gap-1 px-3" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <span className="font-semibold md:hidden">Chanakya AI</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <div className="text-right leading-tight">
              <div className="font-medium">{user.name}</div>
              <div className="text-xs text-muted-foreground">
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
        <NavLinks items={items} className="flex gap-1 overflow-x-auto border-b px-2 py-1 md:hidden" />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
