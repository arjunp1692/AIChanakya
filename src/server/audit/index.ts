import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;
type Plain = Record<string, unknown>;

export type FieldDiff = Record<string, { from: unknown; to: unknown }>;

function normalize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (v === undefined) return null;
  return v;
}

function same(a: unknown, b: unknown): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (x === y) return true;
  if (typeof x === "object" && typeof y === "object" && x !== null && y !== null) {
    return JSON.stringify(x) === JSON.stringify(y);
  }
  return false;
}

/** Field-level diff: only keys whose value changed. `before`/`after` null = create/delete. */
export function diffFields(before: Plain | null | undefined, after: Plain | null | undefined): FieldDiff {
  const b = before ?? {};
  const a = after ?? {};
  const diff: FieldDiff = {};
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (key === "updatedAt") continue;
    if (!same(b[key], a[key])) diff[key] = { from: normalize(b[key]), to: normalize(a[key]) };
  }
  return diff;
}

export type ActivityInput = {
  actor: string | null;
  entity: string;
  entityId: string;
  action: string;
  before?: Plain | null;
  after?: Plain | null;
};

/** Writes an ActivityLog row with only the changed fields. Call inside the mutation's transaction. */
export async function logActivity(tx: Tx, input: ActivityInput) {
  const diff = diffFields(input.before, input.after);
  return tx.activityLog.create({
    data: {
      actorId: input.actor,
      entity: input.entity,
      entityId: input.entityId,
      action: input.action,
      diff: diff as Prisma.InputJsonValue,
    },
  });
}

export type TicketEventInput = {
  ticketId: string;
  actor: string | null;
  /** e.g. CREATED, STATUS_CHANGED, FIELD_CHANGED, PROGRESS, COMMENT, REOPENED */
  type: string;
  field?: string;
  from?: unknown;
  to?: unknown;
  reason?: string;
};

function str(v: unknown): string | null {
  const n = normalize(v);
  if (n === null) return null;
  return typeof n === "string" ? n : JSON.stringify(n);
}

/** Appends to a ticket's visible history timeline. Call inside the mutation's transaction. */
export async function recordTicketEvent(tx: Tx, input: TicketEventInput) {
  return tx.ticketEvent.create({
    data: {
      ticketId: input.ticketId,
      actorId: input.actor,
      type: input.type,
      field: input.field ?? null,
      fromValue: str(input.from),
      toValue: str(input.to),
      reason: input.reason ?? null,
    },
  });
}
