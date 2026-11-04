import { redirect } from "next/navigation";
import { navAccess } from "@/lib/nav";
import { requirePermission } from "@/server/auth/session";

export default async function ReportsPage() {
  await requirePermission(...navAccess("/reports"));
  redirect("/reports/daily");
}
