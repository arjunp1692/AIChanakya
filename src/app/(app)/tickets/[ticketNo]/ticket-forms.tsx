"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Priority } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/constants";
import { addCommentAction, updateTicketAction, type TicketFormState } from "./actions";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

type EditProps = {
  ticketId: string;
  ticketNo: string;
  title: string;
  description: string;
  priority: Priority;
  ownerId: string;
  /** Null when the user may not reassign. */
  owners: { id: string; name: string }[] | null;
};

export function EditTicketForm({ ticketId, ticketNo, title, description, priority, ownerId, owners }: EditProps) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    updateTicketAction.bind(null, ticketId, ticketNo),
    {},
  );
  const [owner, setOwner] = useState(ownerId);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-md border p-4">
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <Input id="title" name="title" defaultValue={title} required maxLength={200} />
        <FieldError errors={errors.title} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <Textarea id="description" name="description" defaultValue={description} rows={4} />
        <FieldError errors={errors.description} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="priority" className="text-sm font-medium">
            Priority
          </label>
          <select id="priority" name="priority" defaultValue={priority} className={selectClass}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <FieldError errors={errors.priority} />
        </div>
        {owners && (
          <div className="space-y-1.5">
            <label htmlFor="ownerId" className="text-sm font-medium">
              Owner
            </label>
            <select
              id="ownerId"
              name="ownerId"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={selectClass}
            >
              {owners.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <FieldError errors={errors.ownerId} />
          </div>
        )}
      </div>
      {owners && owner !== ownerId && (
        <div className="space-y-1.5">
          <label htmlFor="ownerReason" className="text-sm font-medium">
            Reason for owner change
          </label>
          <Input id="ownerReason" name="ownerReason" required maxLength={1000} />
          <FieldError errors={errors.ownerReason} />
        </div>
      )}
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CommentForm({ ticketId, ticketNo }: { ticketId: string; ticketNo: string }) {
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    addCommentAction.bind(null, ticketId, ticketNo),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <Textarea name="body" rows={3} placeholder="Add a comment…" required maxLength={10_000} />
      <FieldError errors={state.fieldErrors?.body} />
      {state.error && !state.fieldErrors?.body && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Posting…" : "Comment"}
      </Button>
    </form>
  );
}
