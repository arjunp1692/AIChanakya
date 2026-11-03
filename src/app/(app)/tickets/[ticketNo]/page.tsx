import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { SectionHeader } from "@/components/section-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  CONTRIBUTION_BADGE,
  CONTRIBUTION_LABELS,
  OVERDUE_BADGE,
  PENDING_BANNER,
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  STATUS_BADGE,
  STATUS_LABELS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { can, ForbiddenError } from "@/server/authz";
import { prisma } from "@/server/db";
import { getTicketDetail, type TicketDetail } from "@/server/tickets/detail";
import { isOpenStatus } from "@/lib/ticket-utils";
import { allowedNextStatuses, needsReason } from "@/server/tickets/workflow";
import { canDecideDeadline, deadlineNeedsApproval } from "@/server/tickets/deadline";
import type { ContributionStatus } from "@prisma/client";
import { isDependencyResolved } from "@/server/tickets/dependencies";
import {
  AddAssigneeForm,
  AddDependencyForm,
  CommentForm,
  ContributionForm,
  DeadlineControl,
  DeadlineDecision,
  DependencyButton,
  EditTicketForm,
  ProgressForm,
  RemoveAssigneeButton,
  StatusControl,
} from "./ticket-forms";

const badge = "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });
/** "YYYY-MM-DD" in IST, for `<input type="date">`. */
const isoDateIST = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  priority: "Priority",
  ownerId: "Owner",
  status: "Status",
  dueDate: "Due date",
  completedAt: "Completed at",
  progress: "Progress",
};

const DEADLINE_EVENTS: Record<string, string> = {
  DEADLINE_CHANGED: "Changed deadline",
  DEADLINE_REQUESTED: "Requested deadline change",
  DEADLINE_REJECTED: "Rejected deadline change",
};

const DEPENDENCY_EVENTS: Record<string, string> = {
  DEPENDENCY_ADDED: "Now waiting on",
  DEPENDENCY_REMOVED: "No longer waiting on",
  DEPENDENCY_RESOLVED: "External prerequisite resolved:",
  DEPENDENT_ADDED: "Now blocking",
  DEPENDENT_REMOVED: "No longer blocking",
};

async function loadOrForbid(user: Awaited<ReturnType<typeof requireUser>>, ticketNo: string) {
  try {
    return await getTicketDetail(user, ticketNo);
  } catch (err) {
    if (err instanceof ForbiddenError) redirect("/forbidden");
    throw err;
  }
}

/** Human value for a history entry: user IDs → names, enum values → labels, ISO dates → IST. */
function eventValue(field: string | null, value: string | null, names: Map<string, string>): string {
  if (value === null) return "—";
  if (field === "ownerId" || field === "assignee") return names.get(value) ?? value;
  if (field === "priority" && value in PRIORITY_LABELS) return PRIORITY_LABELS[value as keyof typeof PRIORITY_LABELS];
  if ((field === "status" || field === null) && value in STATUS_LABELS) return STATUS_LABELS[value as keyof typeof STATUS_LABELS];
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return fmtDateTime(new Date(value));
  return value.length > 120 ? `${value.slice(0, 120)}…` : value;
}

/** CONTRIBUTION event value (`{"status","progress"}` JSON) → "In progress · 40%". */
function contributionValue(value: string | null): string {
  if (!value) return "—";
  try {
    const v = JSON.parse(value) as { status: ContributionStatus; progress: number };
    return `${CONTRIBUTION_LABELS[v.status] ?? v.status} · ${v.progress}%`;
  } catch {
    return value;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

function FieldsPanel({ t }: { t: TicketDetail }) {
  const deadlineMoved =
    t.originalDueDate && t.dueDate && t.originalDueDate.getTime() !== t.dueDate.getTime();
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm">
      <Field label="Department">
        {t.department.name} ({t.department.code})
      </Field>
      <Field label="Owner">{t.owner.name}</Field>
      <Field label="Created by">{t.createdBy.name}</Field>
      <Field label="Created">{fmtDateTime(t.createdAt)}</Field>
      <Field label="Last updated">{fmtDateTime(t.updatedAt)}</Field>
      <Field label={deadlineMoved ? "Current due date" : "Due date"}>
        {t.dueDate ? fmtDate(t.dueDate) : `No deadline: ${t.noDeadlineReason ?? "—"}`}
      </Field>
      {t.originalDueDate && (
        <Field label="Original due date">
          {fmtDate(t.originalDueDate)}
          {deadlineMoved && <span className="text-muted-foreground"> (changed)</span>}
        </Field>
      )}
      <Field label="Extensions">{t.extensionCount}</Field>
      <Field label="Progress">{t.progress}%</Field>
      {t.blockerReason && <Field label="Blocker">{t.blockerReason}</Field>}
      <Field label="Confidential">{t.confidential ? "Yes" : "No"}</Field>
      {t.completedAt && <Field label="Completed">{fmtDateTime(t.completedAt)}</Field>}
      {t.validatedBy && (
        <Field label="Validated">
          {t.validatedBy.name}
          {t.validatedAt && ` · ${fmtDateTime(t.validatedAt)}`}
        </Field>
      )}
      <Field label="Reopened">{t.reopenCount}</Field>
      {t.duplicateOf && (
        <Field label="Duplicate of">
          <a className="text-content-link underline underline-offset-2" href={`/tickets/${t.duplicateOf.ticketNo}`}>
            {t.duplicateOf.ticketNo}
          </a>
        </Field>
      )}
    </dl>
  );
}

export default async function TicketPage({ params }: { params: Promise<{ ticketNo: string }> }) {
  const { ticketNo } = await params;
  const user = await requireUser();
  const t = await loadOrForbid(user, decodeURIComponent(ticketNo));
  if (!t) notFound();

  const canEdit = can(user, "ticket.edit", t.resource);
  const canAssign = canEdit && can(user, "ticket.assign", t.resource);
  const canComment = can(user, "ticket.comment", t.resource);
  const canChangeStatus = can(user, "ticket.changeStatus", t.resource);
  const statusOptions = canChangeStatus
    ? allowedNextStatuses(user, t.status).map((s) => ({ status: s, needsReason: needsReason(t.status, s) }))
    : [];
  const canChangeDeadline = can(user, "ticket.changeDeadline", t.resource) && isOpenStatus(t.status);
  const needsApproval = canChangeDeadline && (await deadlineNeedsApproval(user));
  const pendingDeadline = t.deadlineChanges[0];
  const canDecide = !!pendingDeadline && canDecideDeadline(user, t.resource);
  const canManageAssignees = can(user, "ticket.assign", t.resource);
  const myContribution = isOpenStatus(t.status) ? t.assignees.find((a) => a.userId === user.id) : undefined;

  const people =
    canManageAssignees && isOpenStatus(t.status)
      ? (
          await prisma.user.findMany({
            where: { active: true, id: { notIn: [t.ownerId, ...t.assignees.map((a) => a.userId)] } },
            select: { id: true, name: true, department: { select: { code: true } } },
            orderBy: { name: "asc" },
          })
        ).map((u) => ({ id: u.id, name: u.name, dept: u.department?.code ?? null }))
      : null;

  const owners = canAssign
    ? await prisma.user.findMany({
        where: { departmentId: t.departmentId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : null;

  // Resolve owner / co-assignee IDs referenced in history to names.
  const ownerIds = t.events.flatMap((e) =>
    e.field === "ownerId" || e.field === "assignee" ? [e.fromValue, e.toValue] : [],
  );
  const ids = [...new Set(ownerIds.filter((v): v is string => !!v))];
  const names = new Map(
    (ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []).map(
      (u) => [u.id, u.name],
    ),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-xs text-career-muted">{t.ticketNo}</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-heading-big font-bold text-career-dark line-clamp-3">{t.title}</h1>
          {canEdit && (
            <EditTicketForm
              ticketId={t.id}
              ticketNo={t.ticketNo}
              title={t.title}
              description={t.description}
              priority={t.priority}
              ownerId={t.ownerId}
              owners={owners}
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={cn(badge, STATUS_BADGE[t.status])}>{STATUS_LABELS[t.status]}</span>
          <span className={cn(badge, PRIORITY_BADGE[t.priority])}>{PRIORITY_LABELS[t.priority]}</span>
          {t.overdue && <span className={cn(badge, OVERDUE_BADGE)}>Overdue</span>}
          {t.confidential && <span className={cn(badge, "bg-chip-bg text-primary")}>Confidential</span>}
        </div>
        {pendingDeadline && (
          <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-md p-3 text-sm", PENDING_BANNER)}>
            <div>
              <p className="font-semibold">
                Deadline change waiting for HOD approval:{" "}
                {pendingDeadline.from ? fmtDate(pendingDeadline.from) : "no deadline"} → {fmtDate(pendingDeadline.to)}
              </p>
              <p>
                Requested by {pendingDeadline.requestedBy.name} · {fmtDateTime(pendingDeadline.at)} · Reason:{" "}
                {pendingDeadline.reason}
              </p>
            </div>
            {canDecide && <DeadlineDecision ticketId={t.id} ticketNo={t.ticketNo} changeId={pendingDeadline.id} />}
          </div>
        )}
        {(statusOptions.length > 0 || (canChangeStatus && isOpenStatus(t.status)) || canChangeDeadline) && (
          <div className="flex flex-wrap items-center gap-4">
            <StatusControl ticketId={t.id} ticketNo={t.ticketNo} status={t.status} options={statusOptions} />
            {canChangeDeadline && !pendingDeadline && (
              <DeadlineControl
                ticketId={t.id}
                ticketNo={t.ticketNo}
                dueDate={t.dueDate ? isoDateIST(t.dueDate) : null}
                needsApproval={needsApproval}
              />
            )}
            {canChangeStatus && isOpenStatus(t.status) && (
              <div className="w-full max-w-sm">
                <ProgressForm key={t.progress} ticketId={t.id} ticketNo={t.ticketNo} progress={t.progress} />
              </div>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <SectionHeader title="Description" />
            </CardHeader>
            <CardContent>
              {t.description ? (
                <p className="whitespace-pre-wrap text-sm">{t.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionHeader title={<>Contributions ({t.assignees.length})</>}>
                {people && <AddAssigneeForm ticketId={t.id} ticketNo={t.ticketNo} people={people} />}
              </SectionHeader>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                Owner (accountable): <span className="font-semibold text-career-dark">{t.owner.name}</span>
              </p>
              {t.assignees.length === 0 ? (
                <p className="text-muted-foreground">No co-assignees.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b border-divider">
                        <th className="py-2 pr-3 font-medium">Co-assignee</th>
                        <th className="py-2 pr-3 font-medium">Responsibility</th>
                        <th className="py-2 pr-3 font-medium">Status</th>
                        <th className="py-2 pr-3 font-medium">Progress</th>
                        <th className="py-2 pr-3 font-medium">Note</th>
                        {canManageAssignees && <th className="py-2" />}
                      </tr>
                    </thead>
                    <tbody>
                      {t.assignees.map((a) => (
                        <tr key={a.id} className="border-b border-divider align-top last:border-0">
                          <td className="py-2 pr-3 whitespace-nowrap">{a.user.name}</td>
                          <td className="py-2 pr-3">{a.responsibility || "—"}</td>
                          <td className="py-2 pr-3">
                            <span className={cn(badge, CONTRIBUTION_BADGE[a.contributionStatus])}>
                              {CONTRIBUTION_LABELS[a.contributionStatus]}
                            </span>
                          </td>
                          <td className="py-2 pr-3 tabular-nums">{a.progress}%</td>
                          <td className="py-2 pr-3 whitespace-pre-wrap text-muted-foreground">{a.note ?? "—"}</td>
                          {canManageAssignees && (
                            <td className="py-1">
                              <RemoveAssigneeButton ticketId={t.id} ticketNo={t.ticketNo} assigneeId={a.id} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {myContribution && (
                <ContributionForm
                  key={myContribution.updatedAt.getTime()}
                  ticketId={t.id}
                  ticketNo={t.ticketNo}
                  assigneeId={myContribution.id}
                  contributionStatus={myContribution.contributionStatus}
                  progress={myContribution.progress}
                  note={myContribution.note}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionHeader title={<>Comments ({t.comments.length})</>} />
            </CardHeader>
            <CardContent className="space-y-4">
              {t.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
              <ul className="space-y-3">
                {t.comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-career-dark">{c.author.name}</span> · {fmtDateTime(c.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  </li>
                ))}
              </ul>
              {canComment && <CommentForm ticketId={t.id} ticketNo={t.ticketNo} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionHeader title="History" />
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l-2 border-divider pl-4">
                {t.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-career-dark">{e.actor?.name ?? "System"}</span> ·{" "}
                      {fmtDateTime(e.at)}
                    </p>
                    <p>
                      {e.type === "FIELD_CHANGED" ? (
                        <>
                          Changed {FIELD_LABELS[e.field ?? ""] ?? e.field}:{" "}
                          <span className="text-muted-foreground">{eventValue(e.field, e.fromValue, names)}</span> →{" "}
                          {eventValue(e.field, e.toValue, names)}
                        </>
                      ) : e.type === "STATUS_CHANGED" || e.type === "REOPENED" ? (
                        <>
                          {e.type === "REOPENED" ? "Reopened" : "Changed status"}:{" "}
                          <span className="text-muted-foreground">{eventValue("status", e.fromValue, names)}</span> →{" "}
                          {eventValue("status", e.toValue, names)}
                        </>
                      ) : e.type === "PROGRESS" ? (
                        <>
                          Progress: <span className="text-muted-foreground">{e.fromValue ?? 0}%</span> → {e.toValue}%
                        </>
                      ) : e.type in DEADLINE_EVENTS ? (
                        <>
                          {DEADLINE_EVENTS[e.type]}:{" "}
                          <span className="text-muted-foreground">
                            {e.fromValue ? fmtDate(new Date(e.fromValue)) : "no deadline"}
                          </span>{" "}
                          → {e.toValue ? fmtDate(new Date(e.toValue)) : "—"}
                        </>
                      ) : e.type === "ASSIGNEE_ADDED" ? (
                        <>Added co-assignee {eventValue("assignee", e.toValue, names)}</>
                      ) : e.type === "ASSIGNEE_REMOVED" ? (
                        <>Removed co-assignee {eventValue("assignee", e.fromValue, names)}</>
                      ) : e.type === "CONTRIBUTION" ? (
                        <>
                          Updated contribution:{" "}
                          <span className="text-muted-foreground">{contributionValue(e.fromValue)}</span> →{" "}
                          {contributionValue(e.toValue)}
                        </>
                      ) : e.type in DEPENDENCY_EVENTS ? (
                        <>
                          {DEPENDENCY_EVENTS[e.type]} {e.toValue ?? e.fromValue}
                        </>
                      ) : e.type === "COMMENT" ? (
                        "Commented"
                      ) : e.type === "CREATED" ? (
                        <>Created ({eventValue(null, e.toValue, names)})</>
                      ) : (
                        <>
                          {e.type}
                          {e.field && ` ${FIELD_LABELS[e.field] ?? e.field}`}
                          {(e.fromValue || e.toValue) &&
                            `: ${eventValue(e.field, e.fromValue, names)} → ${eventValue(e.field, e.toValue, names)}`}
                        </>
                      )}
                    </p>
                    {e.reason && (
                      <p className="text-muted-foreground">
                        {e.type === "CONTRIBUTION" ? "Note" : e.type === "ASSIGNEE_ADDED" ? "Responsibility" : "Reason"}:{" "}
                        {e.reason}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <SectionHeader title="Details" />
            </CardHeader>
            <CardContent>
              <FieldsPanel t={t} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionHeader title="Dependencies">
                {canEdit && isOpenStatus(t.status) && <AddDependencyForm ticketId={t.id} ticketNo={t.ticketNo} />}
              </SectionHeader>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Waiting on ({t.dependencies.length})</p>
                {t.dependencies.length === 0 && <p className="text-muted-foreground">Nothing.</p>}
                <ul className="space-y-2">
                  {t.dependencies.map((d) => {
                    const resolved = isDependencyResolved(d);
                    return (
                      <li key={d.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          {d.dependsOnTicket ? (
                            <>
                              <a className="font-mono text-content-link underline underline-offset-2" href={`/tickets/${d.dependsOnTicket.ticketNo}`}>
                                {d.dependsOnTicket.ticketNo}
                              </a>{" "}
                              <span className="line-clamp-2">{d.dependsOnTicket.title}</span>
                              <span className={cn(badge, STATUS_BADGE[d.dependsOnTicket.status])}>
                                {STATUS_LABELS[d.dependsOnTicket.status]}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="whitespace-pre-wrap">{d.externalPrerequisite}</span>{" "}
                              <span className={cn(badge, resolved ? STATUS_BADGE.COMPLETED : STATUS_BADGE.BLOCKED)}>
                                External · {resolved ? "Resolved" : "Unresolved"}
                              </span>
                            </>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex shrink-0">
                            {!d.dependsOnTicket && !d.resolved && (
                              <DependencyButton ticketId={t.id} ticketNo={t.ticketNo} dependencyId={d.id} op="resolve" />
                            )}
                            <DependencyButton ticketId={t.id} ticketNo={t.ticketNo} dependencyId={d.id} op="remove" />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Blocking ({t.dependents.length})</p>
                {t.dependents.length === 0 && <p className="text-muted-foreground">Nothing.</p>}
                <ul className="space-y-2">
                  {t.dependents.map((d) => (
                    <li key={d.id} className="space-y-1">
                      <a className="font-mono text-content-link underline underline-offset-2" href={`/tickets/${d.ticket.ticketNo}`}>
                        {d.ticket.ticketNo}
                      </a>{" "}
                      <span className="line-clamp-2">{d.ticket.title}</span>
                      <span className={cn(badge, STATUS_BADGE[d.ticket.status])}>{STATUS_LABELS[d.ticket.status]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <SectionHeader title="Attachments" />
            </CardHeader>
            <CardContent className="text-sm">
              {t.attachments.length === 0 ? (
                <p className="text-muted-foreground">None.</p>
              ) : (
                <ul className="space-y-1">
                  {t.attachments.map((a) => (
                    <li key={a.id}>
                      {a.name}
                      {a.isEvidence && <span className="text-muted-foreground"> · evidence</span>}
                      <span className="text-muted-foreground"> · {a.uploadedBy.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
