import { Prisma, type TicketStatus } from "@prisma/client";
import { assertCan, ticketVisibilityWhere, type AuthzUser } from "@/server/authz";
import { getSettingValue } from "@/server/settings";
import { dbOf, type ServiceOpts } from "./tx";

const DEFAULT_THRESHOLD = 0.45;
/** Rows read before visibility filtering, so hidden matches can't crowd out visible ones. */
const CANDIDATE_LIMIT = 50;
const SUGGESTION_LIMIT = 5;

export type SimilarTicket = { id: string; ticketNo: string; title: string; status: TicketStatus; score: number };

/** Setting `duplicate.similarityThreshold` (0–1, default 0.45). */
async function similarityThreshold(): Promise<number> {
  const value = await getSettingValue("duplicate.similarityThreshold");
  return typeof value === "number" ? value : DEFAULT_THRESHOLD;
}

/**
 * Open tickets of a department (its own, plus any its people own or co-work on: `deptTicketWhere`)
 * whose title is trigram-similar to `title`, closest first. Not scoped to a user: callers showing
 * the result must go through `suggestSimilarTickets`.
 */
export async function findSimilarTickets(deptId: string, title: string, opts: ServiceOpts = {}): Promise<SimilarTicket[]> {
  const threshold = await similarityThreshold();
  return dbOf(opts).$queryRaw<SimilarTicket[]>(Prisma.sql`
    SELECT t."id", t."ticketNo", t."title", t."status"::text AS "status", similarity(t."title", ${title}) AS "score"
    FROM "Ticket" t
    JOIN "User" o ON o."id" = t."ownerId"
    WHERE t."status" NOT IN ('COMPLETED', 'CANCELLED')
      AND similarity(t."title", ${title}) >= ${threshold}
      AND (
        t."departmentId" = ${deptId}
        OR o."departmentId" = ${deptId}
        OR EXISTS (
          SELECT 1 FROM "TicketAssignee" a
          JOIN "User" u ON u."id" = a."userId"
          WHERE a."ticketId" = t."id" AND u."departmentId" = ${deptId}
        )
      )
    ORDER BY "score" DESC, t."createdAt" DESC
    LIMIT ${CANDIDATE_LIMIT}
  `);
}

/** `findSimilarTickets` limited to what `user` may view, so a suggestion never reveals a hidden ticket. */
export async function suggestSimilarTickets(
  user: AuthzUser,
  deptId: string,
  title: string,
  opts: ServiceOpts = {},
): Promise<SimilarTicket[]> {
  assertCan(user, "ticket.create");
  const similar = await findSimilarTickets(deptId, title, opts);
  if (similar.length === 0) return [];
  const visible = await dbOf(opts).ticket.findMany({
    where: { AND: [ticketVisibilityWhere(user), { id: { in: similar.map((t) => t.id) } }] },
    select: { id: true },
  });
  const ids = new Set(visible.map((t) => t.id));
  return similar.filter((t) => ids.has(t.id)).slice(0, SUGGESTION_LIMIT);
}
