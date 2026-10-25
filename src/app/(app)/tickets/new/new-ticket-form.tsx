"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/constants";
import { createTicketAction, type CreateTicketState } from "./actions";

type Props = {
  departments: { id: string; code: string; name: string }[];
  users: { id: string; name: string; departmentId: string | null }[];
  confidentialDepts: string[];
  currentUserId: string;
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-sm text-destructive">{errors[0]}</p>;
}

export function NewTicketForm({ departments, users, confidentialDepts, currentUserId }: Props) {
  const [state, action, pending] = useActionState<CreateTicketState, FormData>(createTicketAction, {});
  const [departmentId, setDepartmentId] = useState(departments.length === 1 ? departments[0].id : "");
  const [noDeadline, setNoDeadline] = useState(false);
  // Confidential follows the department default until the creator ticks/unticks it.
  const [confidentialOverride, setConfidentialOverride] = useState<boolean | null>(null);

  const dept = departments.find((d) => d.id === departmentId);
  const owners = users.filter((u) => u.departmentId === departmentId);
  const confidential = confidentialOverride ?? (!!dept && confidentialDepts.includes(dept.code));
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <Input id="title" name="title" required maxLength={200} />
        <FieldError errors={errors.title} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <Textarea id="description" name="description" rows={4} />
        <FieldError errors={errors.description} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="departmentId" className="text-sm font-medium">
            Department
          </label>
          <select
            id="departmentId"
            name="departmentId"
            required
            className={selectClass}
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">Select…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
          <FieldError errors={errors.departmentId} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ownerId" className="text-sm font-medium">
            Owner
          </label>
          <select
            id="ownerId"
            name="ownerId"
            required
            className={selectClass}
            key={departmentId}
            defaultValue={owners.some((u) => u.id === currentUserId) ? currentUserId : ""}
          >
            <option value="">Select…</option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <FieldError errors={errors.ownerId} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="priority" className="text-sm font-medium">
            Priority
          </label>
          <select id="priority" name="priority" className={selectClass} defaultValue="MEDIUM">
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="dueDate" className="text-sm font-medium">
            Due date
          </label>
          <Input id="dueDate" name="dueDate" type="date" required={!noDeadline} disabled={noDeadline} />
          <FieldError errors={errors.dueDate} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={noDeadline} onChange={(e) => setNoDeadline(e.target.checked)} />
        No deadline
      </label>
      {noDeadline && (
        <div className="space-y-1.5">
          <label htmlFor="noDeadlineReason" className="text-sm font-medium">
            Reason for no deadline
          </label>
          <Input id="noDeadlineReason" name="noDeadlineReason" required />
          <FieldError errors={errors.noDeadlineReason} />
        </div>
      )}

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confidential}
          onChange={(e) => setConfidentialOverride(e.target.checked)}
        />
        Confidential (visible only to owner, co-assignees, HOD, CEO and CEO Office)
      </label>
      <input type="hidden" name="confidential" value={String(confidential)} />

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create ticket"}
      </Button>
    </form>
  );
}
