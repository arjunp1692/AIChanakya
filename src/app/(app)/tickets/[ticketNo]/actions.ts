"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { serviceError, type ServiceErrorBody } from "@/server/errors";
import { addComment, updateTicket } from "@/server/tickets/service";
import { changeStatus, updateProgress } from "@/server/tickets/workflow";
import { changeDeadline, decideDeadline } from "@/server/tickets/deadline";

export type TicketFormState = Partial<ServiceErrorBody> & { ok?: boolean };

async function run(ticketNo: string, fn: () => Promise<unknown>): Promise<TicketFormState> {
  try {
    await fn();
  } catch (err) {
    const mapped = serviceError(err);
    if (!mapped) throw err;
    return mapped.body;
  }
  revalidatePath(`/tickets/${ticketNo}`);
  return { ok: true };
}

export async function updateTicketAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => updateTicket(user, ticketId, Object.fromEntries(formData)));
}

export async function addCommentAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => addComment(user, ticketId, Object.fromEntries(formData)));
}

export async function changeStatusAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => changeStatus(user, ticketId, Object.fromEntries(formData)));
}

export async function updateProgressAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => updateProgress(user, ticketId, Object.fromEntries(formData)));
}

export async function changeDeadlineAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => changeDeadline(user, ticketId, Object.fromEntries(formData)));
}

export async function decideDeadlineAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => decideDeadline(user, ticketId, Object.fromEntries(formData)));
}
