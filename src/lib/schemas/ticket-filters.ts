import { z } from "zod";
import { PRIORITIES, TICKET_STATUSES } from "@/lib/constants";

export const TICKET_SORT_KEYS = [
  "ticketNo",
  "title",
  "department",
  "owner",
  "priority",
  "status",
  "progress",
  "dueDate",
  "updatedAt",
] as const;
export type TicketSortKey = (typeof TICKET_SORT_KEYS)[number];

type RawParam = string | string[] | undefined;

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const text = z.preprocess((v) => {
  const s = first(v);
  return typeof s === "string" && s.trim() !== "" ? s.trim() : undefined;
}, z.string().max(200).optional());

/** Repeated params (`status=A&status=B`) and comma lists (`status=A,B`) both work. */
const list = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => {
    const parts = (Array.isArray(v) ? v : [v])
      .flatMap((s) => (typeof s === "string" ? s.split(",") : []))
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : undefined;
  }, z.array(item).max(500).optional());

/** "YYYY-MM-DD" as an IST calendar day; `end` = last instant of that day. */
const day = (end: boolean) =>
  z.preprocess((v) => {
    const s = first(v);
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
    const d = new Date(`${s}T${end ? "23:59:59.999" : "00:00:00.000"}+05:30`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, z.date().optional());

const lenient = <T extends z.ZodType>(s: T) => s.catch(undefined as z.output<T>);

/** Ticket list filters, parsed from URL query params. Invalid values are dropped, never thrown. */
export const ticketFiltersSchema = z.object({
  q: lenient(text),
  dept: lenient(list(z.string().regex(/^[A-Za-z]{2,5}$/).transform((s) => s.toUpperCase()))),
  owner: lenient(text),
  assignee: lenient(text),
  status: lenient(list(z.enum(TICKET_STATUSES))),
  priority: lenient(list(z.enum(PRIORITIES))),
  overdue: z.preprocess((v) => first(v) === "1" || first(v) === "true", z.boolean()),
  createdFrom: lenient(day(false)),
  createdTo: lenient(day(true)),
  completedFrom: lenient(day(false)),
  completedTo: lenient(day(true)),
  ids: lenient(list(z.string().max(64))),
  page: z.preprocess((v) => Number(first(v)), z.number().int().min(1)).catch(1),
  sort: z.preprocess(first, z.enum(TICKET_SORT_KEYS)).catch("updatedAt"),
  dir: z.preprocess(first, z.enum(["asc", "desc"])).catch("desc"),
});

export type TicketFilters = z.output<typeof ticketFiltersSchema>;

export function parseTicketFilters(params: Record<string, RawParam>): TicketFilters {
  return ticketFiltersSchema.parse(params);
}
