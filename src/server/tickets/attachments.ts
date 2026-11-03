import type { Attachment } from "@prisma/client";
import { addAttachmentSchema } from "@/lib/schemas/ticket";
import { logActivity, recordTicketEvent } from "@/server/audit";
import { assertCan, can, ForbiddenError, type AuthzUser, type TicketResource } from "@/server/authz";
import { prisma } from "@/server/db";
import { contentTypeFor, storage, uploadProblem } from "@/server/storage";
import { resourceInclude, toTicketResource } from "./detail";
import { TicketInputError } from "./service";

/** Owner/HOD (`ticket.changeStatus`) and co-assignees (`ticket.contribute`) may attach files and links. */
export const canAttach = (user: AuthzUser, resource: TicketResource) =>
  can(user, "ticket.changeStatus", resource) || can(user, "ticket.contribute", resource);

const pick = (a: Attachment) => ({ ticketId: a.ticketId, kind: a.kind, name: a.name, url: a.url, isEvidence: a.isEvidence });

/**
 * Adds a file (stored via `storage`, ≤10 MB, allowlisted types) or an http(s) link to a ticket.
 * Needs `canAttach`. ATTACHMENT_ADDED event + ActivityLog CREATE in one transaction; the stored
 * file is removed again if the transaction fails.
 */
export async function addAttachment(user: AuthzUser, ticketId: string, input: unknown) {
  const data = addAttachmentSchema.parse(input);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: resourceInclude });
  if (!ticket) throw new TicketInputError("ticketId", "Unknown ticket");
  if (!canAttach(user, toTicketResource(ticket))) throw new ForbiddenError("ticket.edit");
  if (ticket.status === "CANCELLED") throw new TicketInputError("file", "A cancelled ticket can't take attachments");

  let key: string | null = null;
  let name: string;
  if (data.kind === "FILE") {
    const file = data.file!;
    const problem = uploadProblem(file.name, file.type, file.size);
    if (problem) throw new TicketInputError("file", problem);
    key = await storage.put(ticket.id, file.name, new Uint8Array(await file.arrayBuffer()));
    name = data.name ?? file.name;
  } else {
    name = data.name ?? data.url!;
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.attachment.create({
        data: {
          ticketId: ticket.id,
          kind: data.kind,
          url: key ?? data.url!,
          name,
          isEvidence: data.isEvidence,
          uploadedById: user.id,
        },
      });
      await recordTicketEvent(tx, {
        ticketId: ticket.id,
        actor: user.id,
        type: "ATTACHMENT_ADDED",
        field: row.isEvidence ? "evidence" : "attachment",
        to: row.name,
      });
      await logActivity(tx, { actor: user.id, entity: "Attachment", entityId: row.id, action: "CREATE", after: pick(row) });
      return row;
    });
  } catch (err) {
    if (key) await storage.delete(key);
    throw err;
  }
}

/**
 * Loads an attachment for download. Throws ForbiddenError unless `user` can view its ticket.
 * Returns a redirect target for links, or the file bytes with name and content type.
 */
export async function getAttachmentDownload(user: AuthzUser, attachmentId: string) {
  const row = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { ticket: { include: resourceInclude } },
  });
  if (!row) return null;
  assertCan(user, "ticket.view", toTicketResource(row.ticket));
  if (row.kind === "LINK") return { kind: "LINK" as const, url: row.url };
  return {
    kind: "FILE" as const,
    name: row.name,
    contentType: contentTypeFor(row.url) ?? "application/octet-stream",
    data: await storage.get(row.url),
  };
}
