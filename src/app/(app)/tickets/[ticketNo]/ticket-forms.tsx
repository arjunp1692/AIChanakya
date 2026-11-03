"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { ContributionStatus, Priority, TicketStatus } from "@prisma/client";
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
import {
  CONTRIBUTION_LABELS,
  CONTRIBUTION_STATUSES,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/constants";
import {
  addAssigneeAction,
  addCommentAction,
  addAttachmentAction,
  addDependencyAction,
  removeDependencyAction,
  resolveDependencyAction,
  searchDependencyTargetsAction,
  removeAssigneeAction,
  updateContributionAction,
  changeDeadlineAction,
  changeStatusAction,
  decideDeadlineAction,
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

/** `label` overrides the status name (e.g. "Validate (Completed)"); `hint` is shown in the confirm dialog. */
export type StatusOption = { status: TicketStatus; needsReason: boolean; label?: string; hint?: string };

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
            {o.label ?? (reopen ? "Reopen (In progress)" : STATUS_LABELS[o.status])}
          </option>
        ))}
      </select>
      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          {target && (
            <form action={action} className="space-y-4">
              <DialogHeader>
                <DialogTitle>
                  {STATUS_LABELS[status]} → {target.label ?? STATUS_LABELS[target.status]}
                </DialogTitle>
                <DialogDescription>
                  {target.hint && <span className="block pb-1 font-medium text-career-dark">{target.hint}</span>}
                  The change and reason are kept in the ticket history.
                </DialogDescription>
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

/** "Change deadline" button + dialog. `needsApproval` = the change will wait for HOD approval. */
export function DeadlineControl({
  ticketId,
  ticketNo,
  dueDate,
  needsApproval,
}: {
  ticketId: string;
  ticketNo: string;
  /** Current due date as "YYYY-MM-DD" (IST), or null. */
  dueDate: string | null;
  needsApproval: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    changeDeadlineAction.bind(null, ticketId, ticketNo),
    {},
  );
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Change deadline
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={action} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Change deadline</DialogTitle>
              <DialogDescription>
                {needsApproval
                  ? "Your request goes to the HOD for approval. The original due date is always kept."
                  : "The new date applies at once. The original due date is always kept."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <label htmlFor="dl-dueDate" className="text-sm font-medium">
                New due date
              </label>
              <Input id="dl-dueDate" name="dueDate" type="date" defaultValue={dueDate ?? ""} required />
              <FieldError errors={errors.dueDate} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dl-reason" className="text-sm font-medium">
                Reason
              </label>
              <Textarea id="dl-reason" name="reason" rows={3} required maxLength={1000} />
              <FieldError errors={errors.reason} />
            </div>
            {state.error && !errors.dueDate && !errors.reason && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : needsApproval ? "Request change" : "Change deadline"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Approve / reject buttons for a pending deadline change (HOD+). */
export function DeadlineDecision({ ticketId, ticketNo, changeId }: { ticketId: string; ticketNo: string; changeId: string }) {
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    decideDeadlineAction.bind(null, ticketId, ticketNo),
    {},
  );

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="changeId" value={changeId} />
      <div className="flex gap-2">
        <Button type="submit" name="approve" value="true" size="sm" disabled={pending}>
          Approve
        </Button>
        <Button type="submit" name="approve" value="false" size="sm" variant="outline" disabled={pending}>
          Reject
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

/** "Add co-assignee" button + dialog. `people` = active users of any department (owner excluded). */
export function AddAssigneeForm({
  ticketId,
  ticketNo,
  people,
}: {
  ticketId: string;
  ticketNo: string;
  people: { id: string; name: string; dept: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    addAssigneeAction.bind(null, ticketId, ticketNo),
    {},
  );
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add co-assignee
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={action} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add co-assignee</DialogTitle>
              <DialogDescription>
                Co-assignees from any department contribute; the owner stays accountable.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <label htmlFor="as-userId" className="text-sm font-medium">
                Person
              </label>
              <select id="as-userId" name="userId" required defaultValue="" className={selectClass}>
                <option value="" disabled>
                  Choose…
                </option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.dept && ` (${p.dept})`}
                  </option>
                ))}
              </select>
              <FieldError errors={errors.userId} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="as-responsibility" className="text-sm font-medium">
                Responsibility
              </label>
              <Input id="as-responsibility" name="responsibility" required maxLength={500} />
              <FieldError errors={errors.responsibility} />
            </div>
            {state.error && !errors.userId && !errors.responsibility && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RemoveAssigneeButton({
  ticketId,
  ticketNo,
  assigneeId,
}: {
  ticketId: string;
  ticketNo: string;
  assigneeId: string;
}) {
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    removeAssigneeAction.bind(null, ticketId, ticketNo),
    {},
  );

  return (
    <form action={action}>
      <input type="hidden" name="assigneeId" value={assigneeId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {pending ? "…" : "Remove"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

/** The signed-in co-assignee's own contribution: status, progress and note. */
export function ContributionForm({
  ticketId,
  ticketNo,
  assigneeId,
  contributionStatus,
  progress,
  note,
}: {
  ticketId: string;
  ticketNo: string;
  assigneeId: string;
  contributionStatus: ContributionStatus;
  progress: number;
  note: string | null;
}) {
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    updateContributionAction.bind(null, ticketId, ticketNo),
    {},
  );
  const [value, setValue] = useState(progress);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-3 rounded-md border border-divider p-3">
      <p className="text-sm font-semibold">Update my contribution</p>
      <input type="hidden" name="assigneeId" value={assigneeId} />
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <div className="space-y-1.5">
          <label htmlFor="ct-status" className="text-sm font-medium">
            Status
          </label>
          <select id="ct-status" name="contributionStatus" defaultValue={contributionStatus} className={selectClass}>
            {CONTRIBUTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTRIBUTION_LABELS[s]}
              </option>
            ))}
          </select>
          <FieldError errors={errors.contributionStatus} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="ct-progress" className="text-sm font-medium">
            Progress
          </label>
          <div className="flex h-9 items-center gap-3">
            <input
              id="ct-progress"
              type="range"
              name="progress"
              min={0}
              max={100}
              step={5}
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="w-10 text-right text-sm tabular-nums">{value}%</span>
          </div>
          <FieldError errors={errors.progress} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="ct-note" className="text-sm font-medium">
          Note
        </label>
        <Textarea id="ct-note" name="note" rows={2} maxLength={1000} defaultValue={note ?? ""} />
        <FieldError errors={errors.note} />
      </div>
      {state.error && !errors.contributionStatus && !errors.progress && !errors.note && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save contribution"}
      </Button>
    </form>
  );
}

/** "Waiting on": another ticket (searched by ID or title) or a free-text external prerequisite. */
export function AddDependencyForm({ ticketId, ticketNo }: { ticketId: string; ticketNo: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"ticket" | "external">("ticket");
  const [matches, setMatches] = useState<{ ticketNo: string; title: string; status: TicketStatus }[]>([]);
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    addDependencyAction.bind(null, ticketId, ticketNo),
    {},
  );
  const seq = useRef(0);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  async function search(q: string) {
    const n = ++seq.current;
    const found = q.trim().length < 2 ? [] : await searchDependencyTargetsAction(ticketId, q);
    if (n === seq.current) setMatches(found);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add dependency
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={action} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add dependency</DialogTitle>
              <DialogDescription>This ticket waits on another ticket or an external prerequisite.</DialogDescription>
            </DialogHeader>
            <div className="flex gap-4 text-sm">
              {(["ticket", "external"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                  {k === "ticket" ? "Another ticket" : "External prerequisite"}
                </label>
              ))}
            </div>
            {kind === "ticket" ? (
              <div className="space-y-1.5">
                <label htmlFor="dep-dependsOn" className="text-sm font-medium">
                  Ticket (search by ID or title)
                </label>
                <Input
                  id="dep-dependsOn"
                  name="dependsOn"
                  list="dep-matches"
                  autoComplete="off"
                  placeholder="KN-…"
                  maxLength={60}
                  onChange={(e) => void search(e.target.value)}
                />
                <datalist id="dep-matches">
                  {matches.map((m) => (
                    <option key={m.ticketNo} value={m.ticketNo}>
                      {m.title} · {STATUS_LABELS[m.status]}
                    </option>
                  ))}
                </datalist>
                <FieldError errors={errors.dependsOn} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label htmlFor="dep-external" className="text-sm font-medium">
                  External prerequisite
                </label>
                <Input id="dep-external" name="externalPrerequisite" maxLength={500} placeholder="e.g. Vendor quote" />
                <FieldError errors={errors.externalPrerequisite} />
              </div>
            )}
            {state.error && !errors.dependsOn && !errors.externalPrerequisite && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Adding…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Remove a dependency, or mark an external prerequisite resolved. */
export function DependencyButton({
  ticketId,
  ticketNo,
  dependencyId,
  op,
}: {
  ticketId: string;
  ticketNo: string;
  dependencyId: string;
  op: "remove" | "resolve";
}) {
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    (op === "remove" ? removeDependencyAction : resolveDependencyAction).bind(null, ticketId, ticketNo),
    {},
  );

  return (
    <form action={action}>
      <input type="hidden" name="dependencyId" value={dependencyId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        {pending ? "…" : op === "remove" ? "Remove" : "Mark resolved"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

/** "Add attachment" button + dialog: upload a file (≤10 MB) or add a link, optionally marked as evidence. */
export function AddAttachmentForm({
  ticketId,
  ticketNo,
  accept,
  evidenceRequired,
}: {
  ticketId: string;
  ticketNo: string;
  /** `accept` attribute for the file input (allowlisted extensions). */
  accept: string;
  evidenceRequired: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"FILE" | "LINK">("FILE");
  const [state, action, pending] = useActionState<TicketFormState, FormData>(
    addAttachmentAction.bind(null, ticketId, ticketNo),
    {},
  );
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Add
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={action} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add attachment</DialogTitle>
              <DialogDescription>
                Upload a file (max 10 MB) or add a link.
                {evidenceRequired && " Completing this ticket needs at least one attachment marked as evidence."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-4 text-sm">
              {(["FILE", "LINK"] as const).map((k) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                  {k === "FILE" ? "File" : "Link"}
                </label>
              ))}
            </div>
            {kind === "FILE" ? (
              <div className="space-y-1.5">
                <label htmlFor="att-file" className="text-sm font-medium">
                  File
                </label>
                <Input id="att-file" name="file" type="file" accept={accept} required />
                <FieldError errors={errors.file} />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="att-url" className="text-sm font-medium">
                    Link
                  </label>
                  <Input id="att-url" name="url" type="url" placeholder="https://…" maxLength={2000} required />
                  <FieldError errors={errors.url} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="att-name" className="text-sm font-medium">
                    Label (optional)
                  </label>
                  <Input id="att-name" name="name" maxLength={200} />
                </div>
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isEvidence" defaultChecked={evidenceRequired} />
              Evidence of completion
            </label>
            {state.error && !errors.file && !errors.url && <p className="text-sm text-destructive">{state.error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Uploading…" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
