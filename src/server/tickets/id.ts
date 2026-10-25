import type { Prisma } from "@prisma/client";

/** Calendar year of `date` in Asia/Kolkata (ticket numbers follow the IST year). */
function istYear(date: Date): number {
  return Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "numeric" }).format(date));
}

export function formatTicketNo(deptCode: string, year: number, seq: number): string {
  return `KN-${deptCode}-${year}-${String(seq).padStart(5, "0")}`;
}

/**
 * Allocates the next ticket number for a department/year inside the caller's transaction.
 * A single upsert-and-increment statement takes a row lock, so concurrent callers serialise
 * on the counter row and never see the same value. Rolled-back transactions release their number.
 */
export async function nextTicketNo(
  tx: Prisma.TransactionClient,
  deptCode: string,
  date: Date = new Date(),
): Promise<string> {
  const year = istYear(date);
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "TicketCounter" ("departmentCode", "year", "last")
    VALUES (${deptCode}, ${year}, 1)
    ON CONFLICT ("departmentCode", "year") DO UPDATE SET "last" = "TicketCounter"."last" + 1
    RETURNING "last"`;
  return formatTicketNo(deptCode, year, Number(rows[0].last));
}
