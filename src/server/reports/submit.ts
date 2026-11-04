import { Prisma, type DailyReport as DailyReportRow } from "@prisma/client";
import { ZodError } from "zod";
import { isoDateIST } from "@/lib/format";
import {
  REPORT_MAX_TOTAL_BYTES,
  REPORT_SECTION_LABELS,
  submitReportSchema,
  type DailyReport,
} from "@/lib/schemas/daily-report";
import { logActivity, recordTicketEvent } from "@/server/audit";
import { assertCan, can, ForbiddenError, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { deptTicketWhere } from "@/server/reports/form";
import { storage } from "@/server/storage";
import { addAssignee } from "@/server/tickets/assignees";
import { addAttachment } from "@/server/tickets/attachments";
import { changeDeadline } from "@/server/tickets/deadline";
import { addDependency } from "@/server/tickets/dependencies";
import { resourceInclude, toTicketResource } from "@/server/tickets/detail";
import { addComment, createTicket, TicketInputError } from "@/server/tickets/service";
import type { ServiceOpts, Tx } from "@/server/tickets/tx";
import { changeStatus, updateProgress } from "@/server/tickets/workflow";

type Row = DailyReport["items"][number];
type LinkRow = Extract<Row, { mode: "link" }>;
type NewRow = Extract<Row, { mode: "new" }>;
type Attachment = Row["attachments"][number];
/** A row of the revision being replaced, with the ticket it landed on. */
type PriorRow = { row: Row; ticketId: string };

type Ctx = {
  user: AuthzUser;
  departmentId: string;
  tx: Tx;
  opts: ServiceOpts;
  files: Map<string, File>;
};

/** A large report runs many services in one transaction; Prisma's 5 s default is too short. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 120_000 };
const MAX_FILL_SECONDS = 4 * 60 * 60;
/** `Decision.decisionDeadline` is required; a request without a date gets this many days. */
const DEFAULT_DECISION_DAYS = 3;
const NEW_ROW_RESPONSIBILITY = "Added via daily report";

const endOfDayIST = (day: string) => new Date(`${day}T23:59:59+05:30`);
const attachmentId = (a: Attachment) => (a.kind === "LINK" ? a.url : a.fileKey);

/** Text a row adds to the ticket: comment on an existing ticket, description on a new one. */
function rowText(row: Row): string {
  const delay = row.section === "DELAYED" && row.reason ? `Reason for delay: ${row.reason}` : "";
  return [row.note, delay].filter(Boolean).join("\n\n");
}

const FIELD_ALIASES: Record<string, string> = {
  ticketId: "ticketNo",
  userId: "assigneeIds",
  file: "attachments",
  url: "attachments",
  body: "note",
};

/** Turns a service failure into an error on the report row (`items.<i>.<field>`) that caused it. */
function rowError(index: number, row: Row, err: unknown): unknown {
  let field: string;
  let message: string;
  if (err instanceof TicketInputError) {
    ({ field, message } = err);
  } else if (err instanceof ZodError) {
    field = String(err.issues[0]?.path.at(-1) ?? "ticketNo");
    message = err.issues[0]?.message ?? "Invalid value";
  } else if (err instanceof ForbiddenError) {
    field = "ticketNo";
    message = "You are not allowed to make this change";
  } else {
    return err;
  }
  const target = field === "dueDate" && row.mode === "link" ? "newDueDate" : (FIELD_ALIASES[field] ?? field);
  const label = row.mode === "link" ? row.ticketNo : row.title;
  return new TicketInputError(`items.${index}.${target}`, `${REPORT_SECTION_LABELS[row.section]} — ${label}: ${message}`);
}

/** Adds the row's attachments that the replaced revision didn't already add. */
async function applyAttachments(ctx: Ctx, ticketId: string, row: Row, prior?: Row) {
  const known = new Set(prior?.attachments.map(attachmentId));
  const isEvidence = row.section === "COMPLETED" || (row.mode === "link" && row.status === "COMPLETED");
  for (const a of row.attachments) {
    if (known.has(attachmentId(a))) continue;
    if (a.kind === "LINK") {
      await addAttachment(ctx.user, ticketId, { kind: "LINK", url: a.url, name: a.name, isEvidence }, ctx.opts);
      continue;
    }
    const file = ctx.files.get(a.fileKey);
    if (!file) throw new TicketInputError("attachments", `Please re-attach ${a.name}`);
    await addAttachment(ctx.user, ticketId, { kind: "FILE", file, name: a.name, isEvidence }, ctx.opts);
  }
}

async function applyText(ctx: Ctx, ticketId: string, row: Row, prior?: Row) {
  const body = rowText(row);
  if (body && body !== (prior ? rowText(prior) : "")) await addComment(ctx.user, ticketId, { body }, ctx.opts);
}

/**
 * Updates the existing ticket; never creates one. Attachments go first because they may be the
 * evidence a completion needs, and progress before status because closed tickets refuse progress.
 * Fields unchanged from the replaced revision are skipped so a resubmission doesn't re-apply them.
 */
async function applyLinkedRow(ctx: Ctx, row: LinkRow, priorRow?: PriorRow) {
  const { user, tx, opts } = ctx;
  const ticketNo = row.ticketNo.toUpperCase();
  const found = await tx.ticket.findFirst({
    where: { ticketNo, ...deptTicketWhere(ctx.departmentId) },
    include: resourceInclude,
  });
  if (!found || !can(user, "ticket.view", toTicketResource(found))) {
    throw new TicketInputError("ticketNo", "Not a ticket of this department");
  }
  const prior = priorRow?.row.mode === "link" && priorRow.ticketId === found.id ? priorRow.row : undefined;

  await applyAttachments(ctx, found.id, row, prior);
  const dueDay = found.dueDate ? isoDateIST(found.dueDate) : "";
  if (row.newDueDate && row.newDueDate !== prior?.newDueDate && row.newDueDate !== dueDay) {
    await changeDeadline(user, found.id, { dueDate: row.newDueDate, reason: row.reason }, opts);
  }
  if (row.progress !== undefined && row.progress !== prior?.progress) {
    await updateProgress(user, found.id, { progress: row.progress }, opts);
  }
  if (row.status && row.status !== prior?.status && row.status !== found.status) {
    await changeStatus(user, found.id, { status: row.status, reason: row.reason }, opts);
  }
  await applyText(ctx, found.id, row, prior);
  return { ticketId: found.id, created: false };
}

/**
 * Creates the row's ticket with its co-assignees and dependencies. A row that already created its
 * ticket in the replaced revision only adds new text and attachments: a resubmission never creates
 * a second ticket, and later ticket edits belong on the ticket itself.
 */
async function applyNewRow(ctx: Ctx, row: NewRow, priorRow?: PriorRow) {
  const { user, opts } = ctx;
  if (priorRow?.row.mode === "new") {
    await applyAttachments(ctx, priorRow.ticketId, row, priorRow.row);
    await applyText(ctx, priorRow.ticketId, row, priorRow.row);
    return { ticketId: priorRow.ticketId, created: false };
  }

  const ticket = await createTicket(
    user,
    {
      title: row.title,
      description: rowText(row),
      departmentId: ctx.departmentId,
      ownerId: row.ownerId,
      priority: row.priority,
      dueDate: row.dueDate,
      duplicateOverride: row.duplicateOverride,
    },
    opts,
  );
  for (const userId of new Set(row.assigneeIds)) {
    await addAssignee(user, ticket.id, { userId, responsibility: NEW_ROW_RESPONSIBILITY }, opts);
  }
  for (const dependsOn of new Set(row.dependsOn)) {
    await addDependency(user, ticket.id, { kind: "ticket", dependsOn }, opts);
  }
  await applyAttachments(ctx, ticket.id, row);
  return { ticketId: ticket.id, created: true };
}

/** Creates PENDING decisions, skipping questions the replaced revision already raised. */
async function createDecisions(ctx: Ctx, data: DailyReport, prior?: DailyReport) {
  const { user, tx, opts } = ctx;
  const raised = new Set(prior?.decisionRequests?.map((r) => r.question));
  for (const [i, request] of data.decisionRequests.entries()) {
    if (raised.has(request.question)) continue;

    let ticketId: string | null = null;
    if (request.ticketNo) {
      const ticket = await tx.ticket.findUnique({
        where: { ticketNo: request.ticketNo.toUpperCase() },
        include: resourceInclude,
      });
      if (!ticket || !can(user, "ticket.view", toTicketResource(ticket))) {
        throw new TicketInputError(`decisionRequests.${i}.ticketNo`, `Decision request ${i + 1}: Unknown ticket ID`);
      }
      ticketId = ticket.id;
    }

    const fallback = new Date(endOfDayIST(data.reportDate).getTime() + DEFAULT_DECISION_DAYS * 86_400_000);
    const decision = await tx.decision.create({
      data: {
        ticketId,
        departmentId: ctx.departmentId,
        requestedById: user.id,
        question: request.question,
        businessImpact: request.impact,
        options: request.options ? [{ label: request.options, detail: "" }] : [],
        recommendation: request.recommendation,
        decisionDeadline: request.deadline ? endOfDayIST(request.deadline) : fallback,
      },
    });
    if (ticketId) {
      await recordTicketEvent(tx, {
        ticketId,
        actor: user.id,
        type: "DECISION_REQUESTED",
        to: decision.question,
        reportId: opts.reportId,
      });
    }
    await logActivity(tx, {
      actor: user.id,
      entity: "Decision",
      entityId: decision.id,
      action: "CREATE",
      after: { ticketId, departmentId: decision.departmentId, question: decision.question, status: decision.status },
    });
  }
}

/** Seconds from the first edit to submission; ignored when missing or implausible (> 4 h). */
function fillSeconds(startedAt: string | undefined, submittedAt: Date): number | null {
  if (!startedAt) return null;
  const seconds = Math.round((submittedAt.getTime() - new Date(startedAt).getTime()) / 1000);
  return seconds >= 0 && seconds <= MAX_FILL_SECONDS ? seconds : null;
}

async function reportResult(report: Pick<DailyReportRow, "id" | "revision">, replayed: boolean) {
  const items = await prisma.dailyReportItem.findMany({
    where: { reportId: report.id },
    select: { created: true, ticket: { select: { ticketNo: true } } },
  });
  const ticketNos = (created: boolean) => [
    ...new Set(items.filter((i) => i.created === created).map((i) => i.ticket.ticketNo)),
  ];
  return { id: report.id, revision: report.revision, created: ticketNos(true), updated: ticketNos(false), replayed };
}

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * Applies a daily report to the ticket database in one transaction: linked rows update their
 * tickets through the ticket services, new rows create tickets, decision requests become PENDING
 * decisions, and every ticket event carries the report id. A repeated `idempotencyKey` returns the
 * stored report. Resubmitting a department/date stores the next revision and leaves earlier payloads
 * untouched; rows are matched by key, so only what changed is applied again.
 * `files` holds uploads by `fileKey`. Throws ZodError, TicketInputError (`items.<i>.<field>` for row
 * failures, rolling back the whole report) or ForbiddenError.
 */
export async function submitDailyReport(user: AuthzUser, input: unknown, files = new Map<string, File>()) {
  const { idempotencyKey, ...data } = submitReportSchema.parse(input);
  const { departmentId } = data;
  assertCan(user, "report.submit", { departmentId });
  if (data.decisionRequests.length) assertCan(user, "decision.request", { departmentId });

  const findExisting = () =>
    prisma.dailyReport.findUnique({
      where: { submittedById_idempotencyKey: { submittedById: user.id, idempotencyKey } },
    });
  const existing = await findExisting();
  if (existing) return reportResult(existing, true);

  const dept = await prisma.department.findFirst({ where: { id: departmentId, active: true } });
  if (!dept) throw new TicketInputError("departmentId", "Unknown department");
  if (data.reportDate > isoDateIST(new Date())) {
    throw new TicketInputError("reportDate", "The reporting date is in the future");
  }
  if (new Set(data.items.map((r) => r.key)).size !== data.items.length) {
    throw new TicketInputError("items", "The report has duplicate rows; reload and try again");
  }
  const totalBytes = [...files.values()].reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > REPORT_MAX_TOTAL_BYTES) {
    throw new TicketInputError("items", "Attached files can be at most 50 MB per report");
  }

  const reportDate = new Date(`${data.reportDate}T00:00:00Z`);
  const submittedAt = new Date();
  const storedKeys: string[] = [];

  try {
    const report = await prisma.$transaction(async (tx) => {
      const previous = await tx.dailyReport.findFirst({
        where: { departmentId, reportDate, isLatest: true },
        include: { items: { select: { rowKey: true, ticketId: true } } },
      });
      if (previous) {
        await tx.dailyReport.updateMany({ where: { id: previous.id, isLatest: true }, data: { isLatest: false } });
        await logActivity(tx, {
          actor: user.id,
          entity: "DailyReport",
          entityId: previous.id,
          action: "UPDATE",
          before: { isLatest: true },
          after: { isLatest: false },
        });
      }

      // Created first: ticket events need its id, and a concurrent double submit stops here.
      const created = await tx.dailyReport.create({
        data: {
          departmentId,
          reportDate,
          submittedById: user.id,
          submittedAt,
          revision: (previous?.revision ?? 0) + 1,
          payload: data as Prisma.InputJsonObject,
          highestPriority: data.highestPriority,
          blockersText: data.blockersText,
          nextDayPriorities: data.nextDayPriorities,
          fillSeconds: fillSeconds(data.startedAt, submittedAt),
          idempotencyKey,
        },
      });
      await logActivity(tx, {
        actor: user.id,
        entity: "DailyReport",
        entityId: created.id,
        action: "CREATE",
        after: {
          departmentId,
          reportDate: data.reportDate,
          revision: created.revision,
          previousId: previous?.id ?? null,
          rows: data.items.length,
        },
      });

      const ctx: Ctx = {
        user,
        departmentId,
        tx,
        opts: { tx, reportId: created.id, storedKeys },
        files,
      };
      const priorPayload = previous?.payload as unknown as DailyReport | undefined;
      const priorRows = new Map<string, PriorRow>();
      for (const row of priorPayload?.items ?? []) {
        const ticketId = previous?.items.find((i) => i.rowKey === row.key)?.ticketId;
        if (row.key && ticketId) priorRows.set(row.key, { row, ticketId });
      }

      for (const [i, row] of data.items.entries()) {
        const prior = priorRows.get(row.key);
        try {
          const applied = row.mode === "link" ? await applyLinkedRow(ctx, row, prior) : await applyNewRow(ctx, row, prior);
          await tx.dailyReportItem.create({
            data: {
              reportId: created.id,
              ticketId: applied.ticketId,
              rowKey: row.key,
              created: applied.created,
              section: row.section,
              note: row.note,
              progress: row.mode === "link" ? (row.progress ?? null) : null,
            },
          });
        } catch (err) {
          throw rowError(i, row, err);
        }
      }
      await createDecisions(ctx, data, priorPayload);
      return created;
    }, TX_OPTIONS);
    return await reportResult(report, false);
  } catch (err) {
    await Promise.all(storedKeys.map((key) => storage.delete(key)));
    if (isUniqueViolation(err)) {
      const winner = await findExisting();
      if (winner) return reportResult(winner, true);
      throw new TicketInputError("reportDate", "Another revision was submitted just now; reload and retry");
    }
    throw err;
  }
}
