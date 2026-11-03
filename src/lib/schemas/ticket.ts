import { z } from "zod";
import { CONTRIBUTION_STATUSES, PRIORITIES, TICKET_STATUSES } from "@/lib/constants";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** "YYYY-MM-DD" (date input) = end of that day in Asia/Kolkata; anything else is parsed as a timestamp. */
function toDueDate(v: unknown) {
  const s = blankToUndefined(v);
  if (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T23:59:59+05:30`);
  return typeof s === "string" ? new Date(s) : s;
}

const dueDate = z.preprocess(toDueDate, z.date({ error: "Invalid due date" }).optional());

const bool = z.preprocess((v) => {
  if (v === "true" || v === "on") return true;
  if (v === "false") return false;
  return blankToUndefined(v);
}, z.boolean().optional());

export const createTicketSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().max(10_000).default(""),
    departmentId: z.preprocess(blankToUndefined, z.string({ error: "Department is required" })),
    ownerId: z.preprocess(blankToUndefined, z.string({ error: "Owner is required" })),
    priority: z.enum(PRIORITIES).default("MEDIUM"),
    dueDate,
    noDeadlineReason: z.preprocess(blankToUndefined, z.string().trim().max(1000).optional()),
    /** Omitted = department default (Setting `confidential.defaultDepts`). */
    confidential: bool,
  })
  .refine((t) => t.dueDate || t.noDeadlineReason, {
    message: "Set a due date or give a reason for no deadline",
    path: ["dueDate"],
  })
  .refine((t) => !(t.dueDate && t.noDeadlineReason), {
    message: "Give either a due date or a no-deadline reason, not both",
    path: ["noDeadlineReason"],
  });

export type CreateTicketInput = z.input<typeof createTicketSchema>;

/** Partial edit: omitted fields are left unchanged. An owner change needs `ownerReason`. */
export const updateTicketSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200).optional(),
  description: z.string().trim().max(10_000).optional(),
  priority: z.preprocess(blankToUndefined, z.enum(PRIORITIES).optional()),
  ownerId: z.preprocess(blankToUndefined, z.string().optional()),
  ownerReason: z.preprocess(blankToUndefined, z.string().trim().max(1000).optional()),
});

export type UpdateTicketInput = z.input<typeof updateTicketSchema>;

/** Status change; `reason` is required for BLOCKED (becomes `blockerReason`), CANCELLED and reopen. */
export const changeStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES, { error: "Choose a status" }),
  reason: z.preprocess(blankToUndefined, z.string().trim().max(1000).optional()),
});

export type ChangeStatusInput = z.input<typeof changeStatusSchema>;

export const updateProgressSchema = z.object({
  progress: z.coerce
    .number()
    .int("Progress must be a whole number")
    .min(0, "Progress must be 0–100")
    .max(100, "Progress must be 0–100"),
});

export const addCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(10_000),
});

/** Deadline change; `reason` is always required. `dueDate` accepts "YYYY-MM-DD" (end of day IST). */
export const changeDeadlineSchema = z.object({
  dueDate: z.preprocess(toDueDate, z.date({ error: "Choose a valid new due date" })),
  reason: z.preprocess(
    (v) => blankToUndefined(v) ?? "",
    z.string().trim().min(1, "Give a reason for the deadline change").max(1000),
  ),
});

export type ChangeDeadlineInput = z.input<typeof changeDeadlineSchema>;

/** HOD decision on a pending deadline change. */
export const decideDeadlineSchema = z.object({
  changeId: z.string().min(1),
  approve: z.preprocess((v) => v === true || v === "true", z.boolean()),
});

/** Add a co-assignee (any department) with what they are responsible for. */
export const addAssigneeSchema = z.object({
  userId: z.preprocess(blankToUndefined, z.string({ error: "Choose a person" })),
  responsibility: z.preprocess(
    (v) => blankToUndefined(v) ?? "",
    z.string().trim().min(1, "Describe their responsibility").max(500),
  ),
});

export const removeAssigneeSchema = z.object({
  assigneeId: z.string().min(1),
});

/** A co-assignee's update to their own contribution row. */
export const updateContributionSchema = z.object({
  assigneeId: z.string().min(1),
  contributionStatus: z.enum(CONTRIBUTION_STATUSES, { error: "Choose a status" }),
  progress: updateProgressSchema.shape.progress,
  note: z.preprocess(blankToUndefined, z.string().trim().max(1000).optional()),
});

/** Add a dependency: another ticket (by ticket ID) or a free-text external prerequisite. */
export const addDependencySchema = z
  .object({
    kind: z.enum(["ticket", "external"], { error: "Choose a dependency type" }),
    dependsOn: z.preprocess(blankToUndefined, z.string().trim().max(60).optional()),
    externalPrerequisite: z.preprocess(blankToUndefined, z.string().trim().max(500).optional()),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "ticket" && !v.dependsOn) {
      ctx.addIssue({ code: "custom", path: ["dependsOn"], message: "Choose a ticket" });
    }
    if (v.kind === "external" && !v.externalPrerequisite) {
      ctx.addIssue({ code: "custom", path: ["externalPrerequisite"], message: "Describe the external prerequisite" });
    }
  });

/** Remove a dependency, or mark an external prerequisite resolved. */
export const dependencyIdSchema = z.object({
  dependencyId: z.string().min(1),
});
