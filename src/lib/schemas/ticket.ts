import { z } from "zod";
import { PRIORITIES } from "@/lib/constants";

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** "YYYY-MM-DD" (date input) = end of that day in Asia/Kolkata; anything else is parsed as a timestamp. */
const dueDate = z.preprocess(
  (v) => {
    const s = blankToUndefined(v);
    if (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T23:59:59+05:30`);
    return typeof s === "string" ? new Date(s) : s;
  },
  z.date({ error: "Invalid due date" }).optional(),
);

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

export const addCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(10_000),
});
