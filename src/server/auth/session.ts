import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "./index";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
};

/** Current user from the session; redirects to /login when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id, name, email, role, departmentId } = session.user;
  return { id, name, email, role, departmentId };
}
