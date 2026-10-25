import { ZodError, z } from "zod";
import { ForbiddenError } from "@/server/authz";
import { TicketInputError } from "@/server/tickets/service";

export type ServiceErrorBody = { error: string; fieldErrors?: Record<string, string[]> };

/** Maps known service errors to an HTTP status + body; returns null for anything unexpected. */
export function serviceError(err: unknown): { status: number; body: ServiceErrorBody } | null {
  if (err instanceof ForbiddenError) return { status: 403, body: { error: "You are not allowed to do this." } };
  if (err instanceof ZodError) {
    const fieldErrors = z.flattenError(err).fieldErrors as Record<string, string[]>;
    return { status: 400, body: { error: "Please fix the highlighted fields.", fieldErrors } };
  }
  if (err instanceof TicketInputError) {
    return { status: 400, body: { error: err.message, fieldErrors: { [err.field]: [err.message] } } };
  }
  return null;
}
