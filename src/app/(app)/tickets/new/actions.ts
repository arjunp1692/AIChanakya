"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { serviceError, type ServiceErrorBody } from "@/server/errors";
import { createTicket } from "@/server/tickets/service";
import { suggestSimilarTickets } from "@/server/tickets/similar";

export type CreateTicketState = Partial<ServiceErrorBody>;

/** Open tickets resembling a new title, for the "may already exist" notice. */
export async function similarTicketsAction(departmentId: string, title: string) {
  const user = await requireUser();
  return suggestSimilarTickets(user, departmentId, title);
}

export async function createTicketAction(_prev: CreateTicketState, formData: FormData): Promise<CreateTicketState> {
  const user = await requireUser();
  let ticketNo: string;
  try {
    ({ ticketNo } = await createTicket(user, Object.fromEntries(formData)));
  } catch (err) {
    const mapped = serviceError(err);
    if (!mapped) throw err;
    return mapped.body;
  }
  redirect(`/tickets/${ticketNo}`);
}
