"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Priority, TicketStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import {
  addCommentAction,
  changeStatusAction,
  updateProgressAction,
  updateTicketAction,
  type TicketFormState,
} from "./actions";

const selectClass =
  "h-9 w-full rounded-md border border-career-input-border bg-white px-3 text-sm outline-none focus-visible:border-primary-navy focus-visible:ring-2 focus-visible:ring-primary-navy/30";

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
    <form action={action} className="space-y-3 rounded-md border border-divider bg-surface p-4">
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

export type StatusOption = { status: TicketStatus; needsReason: boolean };

const REASON_LABEL: Partial<Record<TicketStatus, string>> = {
  BLOCKED: "What is blocking this ticket?",
  CANCELLED: "Why is it cancelled?",
};

/** Dropdown of the allowed next statuses; every change is confirmed in a dialog (reason when required). */
export function StatusControl({
  ticketId,
  ticketNo,
  status,
  options,
}: {
  ticketId: string;
  ticketNo: string;
  status: TicketStatus;
  options: StatusOption[];
}) {
  const [target, setTarget] = useState<StatusOption | null>(null);
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    changeStatusAction.bind(null, ticketId, ticketNo),
    {},
  );

  useEffect(() => {
    if (state.ok) setTarget(null);
  }, [state]);

  if (options.length === 0) return null;
  const reopen = status === "COMPLETED";
  const reasonLabel = target && (REASON_LABEL[target.status] ?? (reopen ? "Why is it reopened?" : "Note (optional)"));

  return (
    <>
      <select
        aria-label="Change status"
        value=""
        onChange={(e) => setTarget(options.find((o) => o.status === e.target.value) ?? null)}
        className={`${selectClass} w-auto`}
      >
        <option value="" disabled>
          Change status…
        </option>
        {options.map((o) => (
          <option key={o.status} value={o.status}>
            {reopen ? "Reopen (In progress)" : STATUS_LABELS[o.status]}
          </option>
        ))}
      </select>
      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          {target && (
            <form action={action} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {STATUS_LABELS[status]} → {STATUS_LABELS[target.status]}
                </DialogTitle>
                <DialogDescription>The change and reason are kept in the ticket history.</DialogDescription>
              </DialogHeader>
              <input type="hidden" name="status" value={target.status} />
              <div className="space-y-1.5">
                <label htmlFor="reason" className="text-sm font-medium">
                  {reasonLabel}
                </label>
                <Textarea id="reason" name="reason" rows={3} required={target.needsReason} maxLength={1000} />
                <FieldError errors={state.fieldErrors?.reason} />
              </div>
              {state.error && !state.fieldErrors?.reason && <p className="text-sm text-destructive">{state.error}</p>}
              <DialogFooter>
                <Button type="button" variant="ghost" size="sm" onClick={() => setTarget(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Saving…" : "Confirm"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProgressForm({ ticketId, ticketNo, progress }: { ticketId: string; ticketNo: string; progress: number }) {
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    updateProgressAction.bind(null, ticketId, ticketNo),
    {},
  );
  const [value, setValue] = useState(progress);

  return (
    <form action={action} className="space-y-1.5">
      <div className="flex items-center gap-3">
        <input
          type="range"
          name="progress"
          aria-label="Progress"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="w-10 text-right text-sm tabular-nums">{value}%</span>
        <Button type="submit" size="sm" variant="outline" disabled={pending || value === progress}>
          {pending ? "…" : "Save"}
        </Button>
      </div>
      <FieldError errors={state.fieldErrors?.progress} />
      {state.error && !state.fieldErrors?.progress && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
