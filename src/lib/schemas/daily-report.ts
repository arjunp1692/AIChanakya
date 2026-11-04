import { z } from "zod";
import { PRIORITIES, TICKET_STATUSES } from "@/lib/constants";

/** Shared by the S14 form (client) and S15 submission (server). Files travel as FormData keyed by `fileKey`. */

export const REPORT_SECTIONS = ["COMPLETED", "IN_PROGRESS", "NEW", "PENDING", "DELAYED", "BLOCKED"] as const;
export type ReportSectionKey = (typeof REPORT_SECTIONS)[number];

export const REPORT_SECTION_LABELS: Record<ReportSectionKey, string> = {
  COMPLETED: "Completed today",
  IN_PROGRESS: "In progress",
  NEW: "New tasks",
  PENDING: "Pending",
  DELAYED: "Delayed",
  BLOCKED: "Blocked",
};

export const REPORT_PRIORITIES = ["NORMAL", "HIGH", "CRITICAL"] as const;

/** Mirrors `MAX_UPLOAD_BYTES` in `src/server/storage` (server-only module); S15 re-checks there. */
export const REPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;

/** All files of one report; must stay under `serverActions.bodySizeLimit` in next.config.ts. */
export const REPORT_MAX_TOTAL_BYTES = 50 * 1024 * 1024;

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date");
const optText = (max: number) => z.string().trim().max(max).default("");

export const reportAttachmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("LINK"),
    url: z.url({ protocol: /^https?$/, error: "Enter a valid http(s) link" }).max(2000),
    name: optText(200),
  }),
  z.object({
    kind: z.literal("FILE"),
    fileKey: z.string().min(1),
    name: z.string().trim().min(1).max(200),
    size: z.number().int().min(1).max(REPORT_MAX_FILE_BYTES, "Files can be at most 10 MB"),
  }),
]);

const rowBase = {
  /** Client row id (stable across draft saves). */
  key: z.string().min(1),
  section: z.enum(REPORT_SECTIONS),
  note: optText(2000),
  /** Required for Delayed and Blocked rows and whenever the due date changes. */
  reason: optText(1000),
  attachments: z.array(reportAttachmentSchema).max(10).default([]),
};

export const linkedRowSchema = z.object({
  ...rowBase,
  mode: z.literal("link"),
  ticketNo: z.string().trim().min(1, "Choose a ticket"),
  status: z.enum(TICKET_STATUSES).optional(),
  progress: z.number().int().min(0, "Progress must be 0–100").max(100, "Progress must be 0–100").optional(),
  /** New due date ("YYYY-MM-DD"); blank = unchanged. */
  newDueDate: z.union([isoDay, z.literal("")]).default(""),
});

export const newRowSchema = z.object({
  ...rowBase,
  mode: z.literal("new"),
  title: z.string().trim().min(1, "Title is required").max(200),
  ownerId: z.string().min(1, "Choose an owner"),
  assigneeIds: z.array(z.string().min(1)).max(20).default([]),
  priority: z.enum(PRIORITIES).default("MEDIUM"),
  dueDate: isoDay,
  /** Ticket IDs this new ticket waits on. */
  dependsOn: z.array(z.string().min(1)).max(20).default([]),
});

export const reportRowSchema = z
  .discriminatedUnion("mode", [linkedRowSchema, newRowSchema])
  .superRefine((row, ctx) => {
    if (row.reason) return;
    if (row.section === "DELAYED") {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Give a reason for the delay" });
    } else if (row.section === "BLOCKED") {
      // S09: moving a ticket to BLOCKED needs a blocker reason.
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Describe what is blocking this" });
    } else if (row.mode === "link" && row.newDueDate) {
      ctx.addIssue({ code: "custom", path: ["reason"], message: "Give a reason for the due-date change" });
    }
  });

export const decisionRequestSchema = z.object({
  question: z.string().trim().min(1, "Write the decision question").max(1000),
  impact: optText(2000),
  options: optText(2000),
  recommendation: optText(2000),
  deadline: z.union([isoDay, z.literal("")]).default(""),
  /** Ticket the decision is about; blank = none. */
  ticketNo: z.string().trim().max(60).default(""),
});

export const dailyReportSchema = z.object({
  departmentId: z.string().min(1, "Choose a department"),
  /** IST calendar day. */
  reportDate: isoDay,
  /** First edit of the draft (ISO timestamp) → S15 stores `fillSeconds`. */
  startedAt: z.iso.datetime().optional(),
  items: z.array(reportRowSchema).max(200).default([]),
  blockersText: optText(5000),
  nextDayPriorities: optText(5000),
  highestPriority: z.enum(REPORT_PRIORITIES).default("NORMAL"),
  decisionRequests: z.array(decisionRequestSchema).max(20).default([]),
});

/** What the client submits: the report plus a key that makes a repeated submit a no-op. */
export const submitReportSchema = dailyReportSchema.extend({
  idempotencyKey: z.string().min(8).max(100),
});

export type DailyReportInput = z.input<typeof dailyReportSchema>;
export type DailyReport = z.output<typeof dailyReportSchema>;
export type ReportRow = z.input<typeof reportRowSchema>;
export type ReportAttachment = z.input<typeof reportAttachmentSchema>;
export type DecisionRequestInput = z.input<typeof decisionRequestSchema>;
