import { z } from "zod";
import { isoDateIST } from "@/lib/format";
import { assertCan, type AuthzUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { getSettingValue } from "@/server/settings";

/** PENDING: today, nothing submitted yet, cut-off still ahead. It doesn't count towards the rate. */
export type ComplianceStatus = "ON_TIME" | "LATE" | "MISSING" | "PENDING";
/** IST calendar days ("YYYY-MM-DD"), both inclusive. */
export type CompliancePeriod = { from: string; to: string };

const DEFAULT_WORKING_DAYS = [1, 2, 3, 4, 5, 6];
const DEFAULT_CUTOFF = "19:00";
const DEFAULT_RANGE_DAYS = 14;
const MAX_RANGE_DAYS = 31;
const DAY_MS = 24 * 60 * 60 * 1000;

const workingDaysSchema = z.array(z.number().int().min(1).max(7)).min(1);
// The stored timezone is not read: every reporting day and cut-off is IST.
const cutoffSchema = z.object({ time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });
const isoDay = z.iso.date();

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const isoWeekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay() || 7;

async function reportingRules() {
  const [workingDays, cutoff] = await Promise.all([
    getSettingValue("report.workingDays"),
    getSettingValue("report.cutoff"),
  ]);
  return {
    workingDays: workingDaysSchema.safeParse(workingDays).data ?? DEFAULT_WORKING_DAYS,
    cutoff: cutoffSchema.safeParse(cutoff).data?.time ?? DEFAULT_CUTOFF,
  };
}

/** Period from untrusted `from`/`to`: never past today, at most MAX_RANGE_DAYS, default the last 14 days. */
export function compliancePeriod(from?: unknown, to?: unknown, now = new Date()): CompliancePeriod {
  const today = isoDateIST(now);
  const parsedTo = isoDay.safeParse(to).data;
  const end = parsedTo && parsedTo < today ? parsedTo : today;
  const earliest = addDays(end, 1 - MAX_RANGE_DAYS);
  const parsedFrom = isoDay.safeParse(from).data;
  const start = parsedFrom && parsedFrom <= end ? parsedFrom : addDays(end, 1 - DEFAULT_RANGE_DAYS);
  return { from: start < earliest ? earliest : start, to: end };
}

/**
 * Status of each working day in the period per department, keyed `departmentId:day`. Days after
 * today aren't expected yet. The first revision decides: a later revision can't make an on-time
 * report late. Superseded revisions are kept, so the earliest `submittedAt` is that first one.
 */
async function loadStatuses(departmentIds: string[], { from, to }: CompliancePeriod, now: Date) {
  const { workingDays, cutoff } = await reportingRules();
  const today = isoDateIST(now);
  const lastDay = to < today ? to : today;
  const days: string[] = [];
  for (let day = from; day <= lastDay; day = addDays(day, 1)) {
    if (workingDays.includes(isoWeekday(day))) days.push(day);
  }

  const reports = await prisma.dailyReport.groupBy({
    by: ["departmentId", "reportDate"],
    where: { departmentId: { in: departmentIds }, reportDate: { gte: new Date(from), lte: new Date(to) } },
    _min: { submittedAt: true },
  });
  const firstSubmitted = new Map(
    reports.map((r) => [`${r.departmentId}:${r.reportDate.toISOString().slice(0, 10)}`, r._min.submittedAt]),
  );

  const statuses = new Map<string, ComplianceStatus>();
  for (const departmentId of departmentIds) {
    for (const day of days) {
      const key = `${departmentId}:${day}`;
      const deadline = new Date(`${day}T${cutoff}:00+05:30`);
      const submittedAt = firstSubmitted.get(key);
      if (submittedAt) statuses.set(key, submittedAt <= deadline ? "ON_TIME" : "LATE");
      else statuses.set(key, now > deadline ? "MISSING" : "PENDING");
    }
  }
  return { days, statuses };
}

function summarise(statuses: ComplianceStatus[]) {
  const count = (status: ComplianceStatus) => statuses.filter((s) => s === status).length;
  const onTime = count("ON_TIME");
  const late = count("LATE");
  const missing = count("MISSING");
  const expected = onTime + late + missing;
  /** On-time share of expected reports, in whole percent; null when nothing was expected. */
  const rate = expected ? Math.round((onTime / expected) * 100) : null;
  return { onTime, late, missing, expected, rate };
}

/** Active departments with no report for a working day whose cut-off has passed. */
export async function missingReports(fromDate: string, toDate: string, now = new Date()) {
  const departments = await prisma.department.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
  const { days, statuses } = await loadStatuses(departments.map((d) => d.id), { from: fromDate, to: toDate }, now);
  return departments.flatMap((department) =>
    days.filter((day) => statuses.get(`${department.id}:${day}`) === "MISSING").map((date) => ({ department, date })),
  );
}

/** Reporting compliance of one department: on-time reports over expected reports. */
export async function complianceRate(departmentId: string, period: CompliancePeriod, now = new Date()) {
  const { statuses } = await loadStatuses([departmentId], period, now);
  return summarise([...statuses.values()]);
}

/** Department × day grid for `/reports/compliance`. HODs see their own department. */
export async function getComplianceGrid(user: AuthzUser, period: CompliancePeriod, now = new Date()) {
  assertCan(user, "report.view");
  const departments = await prisma.department.findMany({
    where: { active: true, ...(user.role === "HOD" ? { id: user.departmentId ?? "" } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
  const { days, statuses } = await loadStatuses(departments.map((d) => d.id), period, now);
  return {
    days,
    rows: departments.map((department) => {
      const cells = days.map((day) => statuses.get(`${department.id}:${day}`) ?? "PENDING");
      return { department, cells, ...summarise(cells) };
    }),
  };
}
