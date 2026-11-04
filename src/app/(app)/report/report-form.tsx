"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PRIORITIES, PRIORITY_LABELS, REPORT_PRIORITY_LABELS, STATUS_LABELS, TICKET_STATUSES } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { carryForwardRows } from "@/lib/report-carry-forward";
import {
  REPORT_MAX_FILE_BYTES,
  REPORT_MAX_ROWS,
  REPORT_MAX_TOTAL_BYTES,
  REPORT_PRIORITIES,
  REPORT_SECTIONS,
  REPORT_SECTION_LABELS,
  dailyReportSchema,
  type DecisionRequestInput,
  type ReportAttachment,
  type ReportSectionKey,
  type linkedRowSchema,
  type newRowSchema,
} from "@/lib/schemas/daily-report";
import type { ReportFormData } from "@/server/reports/form";
import { SimilarTicketsNotice, useSimilarTickets } from "../tickets/new/similar-tickets";
import { submitReportAction } from "./actions";

type Props = ReportFormData & { submitterName: string; today: string };
type LinkRow = z.input<typeof linkedRowSchema>;
type NewRow = z.input<typeof newRowSchema>;
type Row = LinkRow | NewRow;
type Draft = {
  startedAt?: string;
  items: Row[];
  blockersText: string;
  nextDayPriorities: string;
  highestPriority: (typeof REPORT_PRIORITIES)[number];
  decisionRequests: DecisionRequestInput[];
};
type Errors = Record<string, string>;

const selectClass =
  "h-9 w-full rounded-md border border-career-input-border bg-white px-3 text-sm outline-none focus-visible:border-primary-navy focus-visible:ring-2 focus-visible:ring-primary-navy/30";

const emptyDraft = (): Draft => ({
  items: [],
  blockersText: "",
  nextDayPriorities: "",
  highestPriority: "NORMAL",
  decisionRequests: [],
});

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const draftKey = (departmentId: string, date: string) => `kn-report-draft:${departmentId}:${date}`;

/** Files are held in memory only, so a restored draft keeps links but drops file attachments. */
function readDraft(key: string, blank: Draft): { draft: Draft; droppedFiles: boolean } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { draft: blank, droppedFiles: false };
    const draft = { ...emptyDraft(), ...(JSON.parse(raw) as Partial<Draft>) };
    let droppedFiles = false;
    draft.items = draft.items.map((row) => {
      const attachments = (row.attachments ?? []).filter((a) => a.kind === "LINK");
      if (attachments.length !== (row.attachments ?? []).length) droppedFiles = true;
      return { ...row, attachments };
    });
    return { draft, droppedFiles };
  } catch {
    return { draft: blank, droppedFiles: false };
  }
}

const reasonRequired = (row: Row) =>
  row.section === "DELAYED" || row.section === "BLOCKED" || (row.mode === "link" && !!row.newDueDate);

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-sm text-destructive">{error}</p>;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      <FieldError error={error} />
    </label>
  );
}

const subscribe = () => () => {};
const CLOSING_SECTIONS = ["Blockers & support needed", "Next-day priorities", "CEO decision requests"];

export function ReportForm(props: Props) {
  const router = useRouter();
  const [reportDate, setReportDate] = useState(props.today);
  // localStorage only exists on the client: render the editor after hydration.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const key = draftKey(props.department.id, reportDate);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-md border border-divider bg-surface p-4 md:grid-cols-3">
        <Field label="Department">
          <select
            className={selectClass}
            value={props.department.code}
            disabled={props.departments.length < 2}
            onChange={(e) => router.push(`/report?dept=${encodeURIComponent(e.target.value)}`)}
          >
            {props.departments.map((d) => (
              <option key={d.id} value={d.code}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reporting date">
          <Input
            type="date"
            value={reportDate}
            max={props.today}
            onChange={(e) => e.target.value && setReportDate(e.target.value)}
          />
        </Field>
        <Field label="Submitter">
          <Input value={props.submitterName} readOnly />
        </Field>
      </div>
      {mounted ? (
        <ReportEditor key={key} storageKey={key} reportDate={reportDate} {...props} />
      ) : (
        <div className="space-y-4">
          {[...REPORT_SECTIONS.map((s) => REPORT_SECTION_LABELS[s]), ...CLOSING_SECTIONS].map((label) => (
            <section key={label} className="rounded-md border border-divider bg-surface p-4">
              <h2 className="text-base font-semibold text-career-dark">{label}</h2>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportEditor({
  storageKey,
  reportDate,
  department,
  tickets,
  users,
  submitted,
}: Props & { storageKey: string; reportDate: string }) {
  const router = useRouter();
  const deptTickets = tickets.filter((t) => t.ownDept);
  const existing = submitted.find((r) => r.reportDate === reportDate);
  const hasSubmittedRows = !!existing?.payload.items.length;
  // A date with submitted rows starts empty: "Load submitted report" keeps their row keys.
  const blankDraft = (): Draft =>
    hasSubmittedRows ? emptyDraft() : { ...emptyDraft(), items: carryForwardRows(deptTickets, reportDate, uid) };
  const [initial] = useState(() => readDraft(storageKey, blankDraft()));
  const [draft, setDraft] = useState<Draft>(initial.draft);
  const [errors, setErrors] = useState<Errors>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const files = useRef(new Map<string, File>());
  // One key per version of the report: a double click or retry repeats it, an edit replaces it.
  const idempotencyKey = useRef(uid());

  useEffect(() => {
    if (draft.startedAt) localStorage.setItem(storageKey, JSON.stringify(draft));
  }, [draft, storageKey]);

  const owners = users.filter((u) => u.departmentId === department.id);

  function edit(fn: (d: Draft) => Draft) {
    idempotencyKey.current = uid();
    setPreview(false);
    setDraft((d) => ({ ...fn(d), startedAt: d.startedAt ?? new Date().toISOString() }));
  }
  const setRow = (i: number, row: Row) => edit((d) => ({ ...d, items: d.items.map((r, j) => (j === i ? row : r)) }));
  const removeRow = (i: number) => edit((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }));
  function addRow(section: ReportSectionKey, mode: Row["mode"]) {
    const base = { key: uid(), section, note: "", reason: "", attachments: [] };
    const row: Row =
      mode === "link"
        ? { ...base, mode, ticketNo: "", newDueDate: "" }
        : { ...base, mode, title: "", ownerId: "", assigneeIds: [], priority: "MEDIUM", dueDate: "", dependsOn: [] };
    edit((d) => ({ ...d, items: [...d.items, row] }));
  }

  function validate(): boolean {
    const result = dailyReportSchema.safeParse({ departmentId: department.id, reportDate, ...draft });
    const issues: { path: PropertyKey[]; message: string }[] = result.success ? [] : [...result.error.issues];
    draft.items.forEach((row, i) => {
      if (row.mode === "link" && row.ticketNo && !deptTickets.some((t) => t.ticketNo === row.ticketNo)) {
        issues.push({ path: ["items", i, "ticketNo"], message: "Not an open ticket of this department" });
      }
    });
    const next: Errors = {};
    const lines: string[] = [];
    for (const issue of issues) {
      const path = issue.path.join(".");
      if (next[path]) continue;
      next[path] = issue.message;
      const [scope, index] = issue.path;
      if (scope === "items" && typeof index === "number") {
        const row = draft.items[index];
        const label = row.mode === "link" ? row.ticketNo || "new link" : row.title || "new ticket";
        lines.push(`${REPORT_SECTION_LABELS[row.section]} — ${label}: ${issue.message}`);
      } else if (scope === "decisionRequests" && typeof index === "number") {
        lines.push(`Decision request ${index + 1}: ${issue.message}`);
      } else {
        lines.push(issue.message);
      }
    }
    setErrors(next);
    setSummary(lines);
    return issues.length === 0;
  }

  function loadSubmitted() {
    if (!existing) return;
    const { items, blockersText, nextDayPriorities, highestPriority, decisionRequests } = existing.payload;
    edit(() => ({ items, blockersText, nextDayPriorities, highestPriority, decisionRequests }));
    setErrors({});
    setSummary([]);
  }

  async function submit() {
    if (submitting || !validate()) return;
    const body = new FormData();
    body.set(
      "payload",
      JSON.stringify({ departmentId: department.id, reportDate, ...draft, idempotencyKey: idempotencyKey.current }),
    );
    let total = 0;
    for (const a of draft.items.flatMap((row) => row.attachments ?? [])) {
      const file = a.kind === "FILE" ? files.current.get(a.fileKey) : undefined;
      if (a.kind === "FILE" && file) {
        body.append(`file:${a.fileKey}`, file);
        total += file.size;
      }
    }
    if (total > REPORT_MAX_TOTAL_BYTES) {
      setSummary(["Attached files can be at most 50 MB per report."]);
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitReportAction(body);
      if ("id" in result) {
        localStorage.removeItem(storageKey);
        files.current.clear();
        router.push(`/reports/daily/${result.id}/submitted`);
        return;
      }
      const fieldErrors = Object.entries(result.fieldErrors ?? {});
      setErrors(Object.fromEntries(fieldErrors.map(([path, messages]) => [path, messages[0]])));
      setSummary(fieldErrors.length ? fieldErrors.map(([, messages]) => messages[0]) : [result.error]);
      setPreview(false);
    } catch {
      setSummary(["The report could not be submitted. Check your connection and try again."]);
    }
    setSubmitting(false);
  }

  function discard() {
    localStorage.removeItem(storageKey);
    files.current.clear();
    setDraft(blankDraft());
    setErrors({});
    setSummary([]);
    setPreview(false);
  }

  return (
    <div className="space-y-4">
      {existing && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-divider bg-surface p-3 text-sm">
          <p>Revision {existing.revision} was already submitted for this date. Submitting again creates a new revision.</p>
          {hasSubmittedRows && (
            <Button type="button" size="sm" variant="outline" onClick={loadSubmitted}>
              Load submitted report
            </Button>
          )}
        </div>
      )}
      <datalist id="report-dept-tickets">
        {deptTickets.map((t) => (
          <option key={t.ticketNo} value={t.ticketNo} label={t.title} />
        ))}
      </datalist>

      {initial.droppedFiles && (
        <p className="rounded-md border border-divider bg-surface p-3 text-sm">
          Draft restored. Attached files are not kept in drafts — please re-attach them.
        </p>
      )}
      {draft.startedAt && <p className="text-xs text-muted-foreground">Draft saved on this device.</p>}
      {!hasSubmittedRows && !draft.startedAt && draft.items.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {draft.items.length} open tickets carried forward. Overdue ones are under Delayed and need a reason; remove any
          row you are not reporting on.
          {deptTickets.length > REPORT_MAX_ROWS &&
            ` Only the first ${REPORT_MAX_ROWS} of ${deptTickets.length} fit in one report.`}
        </p>
      )}

      {REPORT_SECTIONS.map((section) => (
        <section key={section} className="space-y-3 rounded-md border border-divider bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-career-dark">{REPORT_SECTION_LABELS[section]}</h2>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => addRow(section, "link")}>
                + Link ticket
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => addRow(section, "new")}>
                + New ticket
              </Button>
            </div>
          </div>
          {draft.items.map((row, i) =>
            row.section !== section ? null : (
              <div key={row.key} className="space-y-3 rounded-md border border-divider p-3">
                {row.mode === "link" ? (
                  <LinkedRowFields
                    row={row}
                    tickets={deptTickets}
                    errors={errors}
                    prefix={`items.${i}`}
                    onChange={(r) => setRow(i, r)}
                  />
                ) : (
                  <NewRowFields
                    row={row}
                    departmentId={existing?.payload.items.some((r) => r.key === row.key) ? "" : department.id}
                    owners={owners}
                    users={users}
                    tickets={tickets}
                    errors={errors}
                    prefix={`items.${i}`}
                    onChange={(r) => setRow(i, r)}
                    onLink={(ticketNo) => {
                      const { key, section, note, reason, attachments } = row;
                      setRow(i, { key, section, note, reason, attachments, mode: "link", ticketNo, newDueDate: "" });
                    }}
                  />
                )}
                <Field label="Note" error={errors[`items.${i}.note`]}>
                  <Textarea rows={2} value={row.note ?? ""} onChange={(e) => setRow(i, { ...row, note: e.target.value })} />
                </Field>
                {reasonRequired(row) && (
                  <Field
                    label={row.section === "BLOCKED" ? "Blocker reason (required)" : "Reason (required)"}
                    error={errors[`items.${i}.reason`]}
                  >
                    <Input value={row.reason ?? ""} onChange={(e) => setRow(i, { ...row, reason: e.target.value })} />
                  </Field>
                )}
                <AttachmentsEditor
                  attachments={row.attachments ?? []}
                  files={files.current}
                  onChange={(attachments) => setRow(i, { ...row, attachments })}
                />
                <Button type="button" size="sm" variant="ghost" onClick={() => removeRow(i)}>
                  Remove row
                </Button>
              </div>
            ),
          )}
        </section>
      ))}

      <section className="space-y-4 rounded-md border border-divider bg-surface p-4">
        <Field label="Blockers & support needed" error={errors.blockersText}>
          <Textarea
            rows={3}
            value={draft.blockersText}
            onChange={(e) => edit((d) => ({ ...d, blockersText: e.target.value }))}
          />
        </Field>
        <Field label="Next-day priorities" error={errors.nextDayPriorities}>
          <Textarea
            rows={3}
            value={draft.nextDayPriorities}
            onChange={(e) => edit((d) => ({ ...d, nextDayPriorities: e.target.value }))}
          />
        </Field>
        <Field label="Highest priority">
          <select
            className={selectClass}
            value={draft.highestPriority}
            onChange={(e) => edit((d) => ({ ...d, highestPriority: e.target.value as Draft["highestPriority"] }))}
          >
            {REPORT_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {REPORT_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <DecisionRequests
        requests={draft.decisionRequests}
        errors={errors}
        onChange={(decisionRequests) => edit((d) => ({ ...d, decisionRequests }))}
      />

      {summary.length > 0 && (
        <div role="alert" className="space-y-1 rounded-md border border-destructive p-3 text-sm text-destructive">
          <p className="font-medium">Fix these before preview or submit:</p>
          <ul className="list-disc pl-5">
            {summary.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setPreview(validate())}>
          Preview
        </Button>
        <Button type="button" variant="outline" onClick={discard}>
          Discard draft
        </Button>
      </div>

      {preview && (
        <ReportPreview draft={draft} tickets={tickets} users={users} submitting={submitting} onSubmit={submit} />
      )}
    </div>
  );
}

function LinkedRowFields({
  row,
  tickets,
  errors,
  prefix,
  onChange,
}: {
  row: LinkRow;
  tickets: Props["tickets"];
  errors: Errors;
  prefix: string;
  onChange: (row: LinkRow) => void;
}) {
  const ticket = tickets.find((t) => t.ticketNo === row.ticketNo);
  return (
    <div className="space-y-3">
      <Field label="Ticket" error={errors[`${prefix}.ticketNo`]}>
        <Input
          list="report-dept-tickets"
          placeholder="Type a ticket ID or title…"
          value={row.ticketNo}
          onChange={(e) => onChange({ ...row, ticketNo: e.target.value.trim() })}
        />
      </Field>
      {ticket && (
        <p className="text-sm text-muted-foreground">
          {ticket.title} · {STATUS_LABELS[ticket.status]} · {ticket.progress}%
          {ticket.dueDate && ` · due ${fmtDate(new Date(ticket.dueDate))}`}
          {ticket.originalDueDate &&
            ticket.originalDueDate !== ticket.dueDate &&
            ` · originally ${fmtDate(new Date(ticket.originalDueDate))}`}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Status" error={errors[`${prefix}.status`]}>
          <select
            className={selectClass}
            value={row.status ?? ""}
            onChange={(e) => onChange({ ...row, status: (e.target.value || undefined) as LinkRow["status"] })}
          >
            <option value="">Unchanged</option>
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Progress %" error={errors[`${prefix}.progress`]}>
          <Input
            type="number"
            min={0}
            max={100}
            placeholder={ticket ? String(ticket.progress) : ""}
            value={row.progress ?? ""}
            onChange={(e) => onChange({ ...row, progress: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </Field>
        <Field label="New due date" error={errors[`${prefix}.newDueDate`]}>
          <Input type="date" value={row.newDueDate ?? ""} onChange={(e) => onChange({ ...row, newDueDate: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

function NewRowFields({
  row,
  departmentId,
  owners,
  users,
  tickets,
  errors,
  prefix,
  onChange,
  onLink,
}: {
  row: NewRow;
  /** Blank for a row already submitted: its ticket exists and would match itself. */
  departmentId: string;
  owners: Props["users"];
  users: Props["users"];
  tickets: Props["tickets"];
  errors: Errors;
  prefix: string;
  onChange: (row: NewRow) => void;
  onLink: (ticketNo: string) => void;
}) {
  const similar = useSimilarTickets(departmentId, row.title);
  const duplicateError = errors[`${prefix}.duplicateOverride`];
  return (
    <div className="space-y-3">
      <Field label="New ticket title" error={errors[`${prefix}.title`]}>
        <Input
          value={row.title}
          maxLength={200}
          onChange={(e) => onChange({ ...row, title: e.target.value, duplicateOverride: false })}
        />
      </Field>
      {(similar.length > 0 || duplicateError) && (
        <SimilarTicketsNotice
          matches={similar}
          action={(t) => (
            <Button type="button" size="sm" variant="outline" onClick={() => onLink(t.ticketNo)}>
              Link to existing
            </Button>
          )}
        >
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!row.duplicateOverride}
              onChange={(e) => onChange({ ...row, duplicateOverride: e.target.checked })}
            />
            Create anyway: this is a different task
          </label>
          <FieldError error={duplicateError} />
        </SimilarTicketsNotice>
      )}
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Owner" error={errors[`${prefix}.ownerId`]}>
          <select
            className={selectClass}
            value={row.ownerId}
            onChange={(e) =>
              onChange({
                ...row,
                ownerId: e.target.value,
                assigneeIds: (row.assigneeIds ?? []).filter((id) => id !== e.target.value),
              })
            }
          >
            <option value="">Select…</option>
            {owners.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select
            className={selectClass}
            value={row.priority ?? "MEDIUM"}
            onChange={(e) => onChange({ ...row, priority: e.target.value as NewRow["priority"] })}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date" error={errors[`${prefix}.dueDate`]}>
          <Input type="date" value={row.dueDate} onChange={(e) => onChange({ ...row, dueDate: e.target.value })} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ChipPicker
          label="Co-assignees"
          options={users
            .filter((u) => u.id !== row.ownerId)
            .map((u) => ({ value: u.id, label: u.deptCode ? `${u.name} (${u.deptCode})` : u.name }))}
          value={row.assigneeIds ?? []}
          onChange={(assigneeIds) => onChange({ ...row, assigneeIds })}
        />
        <ChipPicker
          label="Depends on (optional)"
          options={tickets.map((t) => ({ value: t.ticketNo, label: `${t.ticketNo} — ${t.title}` }))}
          value={row.dependsOn ?? []}
          onChange={(dependsOn) => onChange({ ...row, dependsOn })}
        />
      </div>
    </div>
  );
}

function ChipPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  return (
    <div className="space-y-1.5">
      <Field label={label}>
        <select
          className={selectClass}
          value=""
          onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        >
          <option value="">Add…</option>
          {options
            .filter((o) => !value.includes(o.value))
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
      </Field>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v} className="flex items-center gap-1 rounded-full border border-divider px-2 py-0.5 text-xs">
              {labelOf(v)}
              <button
                type="button"
                aria-label={`Remove ${labelOf(v)}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachmentsEditor({
  attachments,
  files,
  onChange,
}: {
  attachments: ReportAttachment[];
  files: Map<string, File>;
  onChange: (attachments: ReportAttachment[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [fileError, setFileError] = useState("");

  function addFiles(list: FileList | null) {
    const added: ReportAttachment[] = [];
    const tooBig: string[] = [];
    for (const file of Array.from(list ?? [])) {
      if (file.size > REPORT_MAX_FILE_BYTES) {
        tooBig.push(file.name);
        continue;
      }
      const fileKey = uid();
      files.set(fileKey, file);
      added.push({ kind: "FILE", fileKey, name: file.name, size: file.size });
    }
    setFileError(tooBig.length ? `Files can be at most 10 MB: ${tooBig.join(", ")}` : "");
    if (added.length) onChange([...attachments, ...added]);
  }

  function remove(i: number) {
    const a = attachments[i];
    if (a.kind === "FILE") files.delete(a.fileKey);
    onChange(attachments.filter((_, j) => j !== i));
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Attachments (optional)</span>
      {attachments.length > 0 && (
        <ul className="space-y-1 text-sm">
          {attachments.map((a, i) => (
            <li key={a.kind === "FILE" ? a.fileKey : `${a.url}-${i}`} className="flex items-center gap-2">
              <span className="truncate">{a.kind === "FILE" ? `📎 ${a.name}` : `🔗 ${a.name || a.url}`}</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => remove(i)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 md:flex-row">
        <Input type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!/^https?:\/\/\S+$/.test(url.trim())}
          onClick={() => {
            onChange([...attachments, { kind: "LINK", url: url.trim(), name: "" }]);
            setUrl("");
          }}
        >
          Add link
        </Button>
        <Input
          type="file"
          multiple
          className="md:max-w-60"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <FieldError error={fileError} />
    </div>
  );
}

function DecisionRequests({
  requests,
  errors,
  onChange,
}: {
  requests: DecisionRequestInput[];
  errors: Errors;
  onChange: (requests: DecisionRequestInput[]) => void;
}) {
  const set = (i: number, patch: Partial<DecisionRequestInput>) =>
    onChange(requests.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <section className="space-y-3 rounded-md border border-divider bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-career-dark">CEO decision requests</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([...requests, { question: "", impact: "", options: "", recommendation: "", deadline: "", ticketNo: "" }])
          }
        >
          + Decision request
        </Button>
      </div>
      {requests.map((r, i) => (
        <div key={i} className="space-y-3 rounded-md border border-divider p-3">
          <Field label="Question" error={errors[`decisionRequests.${i}.question`]}>
            <Input value={r.question} onChange={(e) => set(i, { question: e.target.value })} />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Impact">
              <Textarea rows={2} value={r.impact ?? ""} onChange={(e) => set(i, { impact: e.target.value })} />
            </Field>
            <Field label="Options">
              <Textarea rows={2} value={r.options ?? ""} onChange={(e) => set(i, { options: e.target.value })} />
            </Field>
            <Field label="Recommendation">
              <Textarea
                rows={2}
                value={r.recommendation ?? ""}
                onChange={(e) => set(i, { recommendation: e.target.value })}
              />
            </Field>
            <Field label="Decision needed by" error={errors[`decisionRequests.${i}.deadline`]}>
              <Input type="date" value={r.deadline ?? ""} onChange={(e) => set(i, { deadline: e.target.value })} />
            </Field>
            <Field label="Related ticket (optional)" error={errors[`decisionRequests.${i}.ticketNo`]}>
              <Input
                list="report-dept-tickets"
                value={r.ticketNo ?? ""}
                onChange={(e) => set(i, { ticketNo: e.target.value.trim() })}
              />
            </Field>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(requests.filter((_, j) => j !== i))}>
            Remove request
          </Button>
        </div>
      ))}
    </section>
  );
}

function ReportPreview({
  draft,
  tickets,
  users,
  submitting,
  onSubmit,
}: {
  draft: Draft;
  tickets: Props["tickets"];
  users: Props["users"];
  submitting: boolean;
  onSubmit: () => void;
}) {
  const titleOf = (no: string) => tickets.find((t) => t.ticketNo === no)?.title ?? "";
  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "";
  return (
    <section className="space-y-3 rounded-md border border-primary-navy bg-surface p-4 text-sm">
      <h2 className="text-base font-semibold text-career-dark">Preview</h2>
      {REPORT_SECTIONS.map((section) => {
        const rows = draft.items.filter((r) => r.section === section);
        if (!rows.length) return null;
        return (
          <div key={section}>
            <p className="font-medium">
              {REPORT_SECTION_LABELS[section]} ({rows.length})
            </p>
            <ul className="list-disc pl-5">
              {rows.map((r) => (
                <li key={r.key}>
                  {r.mode === "link"
                    ? `${r.ticketNo} — ${titleOf(r.ticketNo)}`
                    : `New: ${r.title} (owner ${nameOf(r.ownerId)}, due ${r.dueDate})`}
                  {r.reason && ` · reason: ${r.reason}`}
                  {r.note && ` · ${r.note}`}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      <p>
        <span className="font-medium">Highest priority:</span> {REPORT_PRIORITY_LABELS[draft.highestPriority]}
      </p>
      {draft.blockersText && (
        <p>
          <span className="font-medium">Blockers:</span> {draft.blockersText}
        </p>
      )}
      {draft.nextDayPriorities && (
        <p>
          <span className="font-medium">Next-day priorities:</span> {draft.nextDayPriorities}
        </p>
      )}
      {draft.decisionRequests.length > 0 && (
        <p>
          <span className="font-medium">Decision requests:</span> {draft.decisionRequests.length}
        </p>
      )}
      <Button type="button" disabled={submitting} onClick={onSubmit}>
        {submitting ? "Submitting…" : "Submit report"}
      </Button>
    </section>
  );
}
