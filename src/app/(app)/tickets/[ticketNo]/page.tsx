import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OVERDUE_BADGE,
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
import { CommentForm, EditTicketForm } from "./ticket-forms";

const badge = "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap";
const fmtDate = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });
const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  priority: "Priority",
  ownerId: "Owner",
  status: "Status",
  dueDate: "Due date",
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
  if (field === "ownerId") return names.get(value) ?? value;
  if (field === "priority" && value in PRIORITY_LABELS) return PRIORITY_LABELS[value as keyof typeof PRIORITY_LABELS];
  if ((field === "status" || field === null) && value in STATUS_LABELS) return STATUS_LABELS[value as keyof typeof STATUS_LABELS];
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return fmtDateTime(new Date(value));
  return value.length > 120 ? `${value.slice(0, 120)}…` : value;
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
      <Field label="Due date">
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
          <a className="underline" href={`/tickets/${t.duplicateOf.ticketNo}`}>
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

  const owners = canAssign
    ? await prisma.user.findMany({
        where: { departmentId: t.departmentId, active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : null;

  // Resolve owner IDs referenced in history to names.
  const ownerIds = t.events.flatMap((e) => (e.field === "ownerId" ? [e.fromValue, e.toValue] : []));
  const ids = [...new Set(ownerIds.filter((v): v is string => !!v))];
  const names = new Map(
    (ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []).map(
      (u) => [u.id, u.name],
    ),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-sm text-muted-foreground">{t.ticketNo}</p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">{t.title}</h1>
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
          {t.confidential && <span className={cn(badge, "bg-muted text-muted-foreground")}>Confidential</span>}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
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
              <CardTitle>Comments ({t.comments.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {t.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
              <ul className="space-y-3">
                {t.comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">{c.author.name}</span> · {fmtDateTime(c.createdAt)}
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
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 border-l pl-4">
                {t.events.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">{e.actor?.name ?? "System"}</span> ·{" "}
                      {fmtDateTime(e.at)}
                    </p>
                    <p>
                      {e.type === "FIELD_CHANGED" ? (
                        <>
                          Changed {FIELD_LABELS[e.field ?? ""] ?? e.field}:{" "}
                          <span className="text-muted-foreground">{eventValue(e.field, e.fromValue, names)}</span> →{" "}
                          {eventValue(e.field, e.toValue, names)}
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
                    {e.reason && <p className="text-muted-foreground">Reason: {e.reason}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldsPanel t={t} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Co-assignees</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {t.assignees.length === 0 ? (
                <p className="text-muted-foreground">None.</p>
              ) : (
                <ul className="space-y-1">
                  {t.assignees.map((a) => (
                    <li key={a.id}>
                      {a.user.name}
                      {a.responsibility && <span className="text-muted-foreground"> — {a.responsibility}</span>}
                      <span className="text-muted-foreground"> · {a.progress}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dependencies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {t.dependencies.length === 0 && t.dependents.length === 0 && (
                <p className="text-muted-foreground">None.</p>
              )}
              {t.dependencies.map((d) => (
                <p key={d.id}>
                  Depends on{" "}
                  {d.dependsOnTicket ? (
                    <a className="font-mono underline" href={`/tickets/${d.dependsOnTicket.ticketNo}`}>
                      {d.dependsOnTicket.ticketNo}
                    </a>
                  ) : (
                    d.externalPrerequisite
                  )}
                  {d.resolved && <span className="text-muted-foreground"> (resolved)</span>}
                </p>
              ))}
              {t.dependents.map((d) => (
                <p key={d.id}>
                  Blocks{" "}
                  <a className="font-mono underline" href={`/tickets/${d.ticket.ticketNo}`}>
                    {d.ticket.ticketNo}
                  </a>
                </p>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Attachments</CardTitle>
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
