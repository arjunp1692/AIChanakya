"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { serviceError, type ServiceErrorBody } from "@/server/errors";
import { addComment, updateTicket } from "@/server/tickets/service";
import { changeStatus, updateProgress } from "@/server/tickets/workflow";
import { addAttachment } from "@/server/tickets/attachments";
import { changeDeadline, decideDeadline } from "@/server/tickets/deadline";
import { addAssignee, removeAssignee, updateContribution } from "@/server/tickets/assignees";
import {
  addDependency,
  removeDependency,
  resolveDependency,
  searchDependencyTargets,
} from "@/server/tickets/dependencies";

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

export async function addAssigneeAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => addAssignee(user, ticketId, Object.fromEntries(formData)));
}

export async function removeAssigneeAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => removeAssignee(user, ticketId, Object.fromEntries(formData)));
}

export async function updateContributionAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => updateContribution(user, ticketId, Object.fromEntries(formData)));
}

export async function addDependencyAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => addDependency(user, ticketId, Object.fromEntries(formData)));
}

export async function removeDependencyAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => removeDependency(user, ticketId, Object.fromEntries(formData)));
}

export async function resolveDependencyAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => resolveDependency(user, ticketId, Object.fromEntries(formData)));
}

export async function addAttachmentAction(
  ticketId: string,
  ticketNo: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const user = await requireUser();
  return run(ticketNo, () => addAttachment(user, ticketId, Object.fromEntries(formData)));
}

/** Ticket picker for "Waiting on": visible tickets matching an ID or title fragment. */
export async function searchDependencyTargetsAction(ticketId: string, q: string) {
  const user = await requireUser();
  return searchDependencyTargets(user, ticketId, q);
}
