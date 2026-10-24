import {
  PrismaClient,
  Prisma,
  Priority,
  ReportPriority,
  ReportSection,
  Role,
  TicketStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "Password@123";
const DAY = 86_400_000;
const HOUR = 3_600_000;
const IST_OFFSET = 330 * 60_000;

// All dates are relative to "today" in Asia/Kolkata so overdue/extended data stays realistic.
const istMidnight = new Date(Math.floor((Date.now() + IST_OFFSET) / DAY) * DAY - IST_OFFSET);
/** Instant `days` from today at `hour`:00 IST. */
const at = (days: number, hour = 18) => new Date(istMidnight.getTime() + days * DAY + hour * HOUR);
/** IST calendar date `days` from today, for @db.Date columns. */
const dateOnly = (days: number) => new Date(istMidnight.getTime() + IST_OFFSET + days * DAY);

const DEPARTMENTS = [
  {
    code: "EDT",
    name: "Editorial",
    people: ["Meera Iyer", "Rohan Kulkarni", "Ananya Bose"],
    titles: [
      "Election coverage explainer series",
      "Fact-check desk SOP refresh",
      "Budget special research pack",
      "Weekly opinion page line-up",
      "Archive tagging backlog",
    ],
  },
  {
    code: "BRD",
    name: "Broadcasting",
    people: ["Vikram Rao", "Sneha Pillai", "Arjun Mehta"],
    titles: [
      "Prime-time bulletin graphics refresh",
      "Backup transmission link test",
      "Regional bulletin slot expansion",
      "Playout server migration",
      "Weekend live coverage roster",
    ],
  },
  {
    code: "PRD",
    name: "Product",
    people: ["Kiran Desai", "Farhan Ali", "Lakshmi Narayan"],
    titles: [
      "Request automation for newsroom tickets",
      "Android app crash fixes",
      "CMS image upload latency",
      "SSO for internal tools",
      "Analytics dashboard data pipeline",
    ],
  },
  {
    code: "MKT",
    name: "Marketing",
    people: ["Priya Sharma", "Nikhil Joshi", "Divya Menon"],
    titles: [
      "Festive season campaign launch",
      "YouTube distribution partnership",
      "Brand refresh guidelines",
      "Newsletter growth experiment",
      "Sponsor deck for election special",
    ],
  },
  {
    code: "HR",
    name: "HR",
    people: ["Sunita Reddy", "Aditya Verma", "Pooja Nair"],
    titles: [
      "Hire two senior video editors",
      "Attendance system rollout",
      "New joiner onboarding kit",
      "Quarterly performance review cycle",
      "Night-shift allowance policy",
    ],
  },
  {
    code: "OPS",
    name: "Operations",
    people: ["Rajesh Gupta", "Kavya Hegde", "Imran Shaikh"],
    titles: [
      "Studio AC replacement procurement",
      "Vendor contract renewals",
      "Office access card audit",
      "Generator maintenance schedule",
      "Asset register reconciliation",
    ],
  },
  {
    code: "COM",
    name: "Communications",
    people: ["Neha Kapoor", "Siddharth Jain", "Ritu Malhotra"],
    titles: [
      "Press release for anniversary event",
      "Crisis communication playbook",
      "Stakeholder newsletter Q4",
      "Media partnership MoU",
      "Industry award submissions",
    ],
  },
  {
    code: "PRO",
    name: "Production",
    people: ["Ashok Patil", "Tanvi Shetty", "Manoj Kumar"],
    titles: [
      "Studio B lighting upgrade",
      "Documentary shoot: Coastal Karnataka",
      "Editing suite storage expansion",
      "Anchor promo shoot",
      "Podcast studio setup",
    ],
  },
] as const;

const STATUS_CYCLE: TicketStatus[] = [
  "NEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "BLOCKED",
  "AWAITING_APPROVAL",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
];
const PRIORITIES: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const OPEN: TicketStatus[] = ["NEW", "ASSIGNED", "IN_PROGRESS", "BLOCKED", "AWAITING_APPROVAL", "ON_HOLD"];

const SETTINGS: Record<string, Prisma.InputJsonValue> = {
  "report.cutoff": { time: "19:00", timezone: "Asia/Kolkata" },
  "reminders.deadlineApproachingHours": [48, 24],
  "reminders.reportBeforeCutoffMinutes": [60, 15],
  "escalation.repeatedDelayExtensions": 2,
  "escalation.missedReportsBeforeEscalation": 1,
  "escalation.criticalBlockerImmediate": true,
  "escalation.decisionOverdueHours": 0,
  // OWNER | HOD | CRITICAL_ONLY (PRD §17 decision 4)
  "completion.validationPolicy": "CRITICAL_ONLY",
  // OWN_DEPT | ALL_SHARED | HYBRID (PRD §17 decision 5)
  "visibility.crossDepartment": "HYBRID",
  "notifications.channels": ["IN_APP", "EMAIL"],
};

type SeedUser = { id: string; name: string; deptCode: string | null };

async function clear() {
  // Reverse dependency order so `pnpm db:seed` can be re-run without a reset.
  await prisma.$transaction([
    prisma.aiInsight.deleteMany(),
    prisma.weeklySnapshot.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.escalation.deleteMany(),
    prisma.decision.deleteMany(),
    prisma.dailyReportItem.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.dailyReport.deleteMany(),
    prisma.deadlineChange.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.ticketEvent.deleteMany(),
    prisma.ticketDependency.deleteMany(),
    prisma.ticketAssignee.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.ticketCounter.deleteMany(),
    prisma.department.updateMany({ data: { hodUserId: null } }),
    prisma.user.deleteMany(),
    prisma.department.deleteMany(),
    prisma.setting.deleteMany(),
  ]);
}

async function main() {
  await clear();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── Settings ──
  await prisma.setting.createMany({
    data: Object.entries(SETTINGS).map(([key, value]) => ({ key, value })),
  });

  // ── Departments & users ──
  const ceo = await prisma.user.create({
    data: { name: "Anand Krishnan", email: "ceo@kubera.local", passwordHash, role: Role.CEO },
  });
  const ceoOffice = await prisma.user.create({
    data: { name: "Shalini Rao", email: "ceooffice@kubera.local", passwordHash, role: Role.CEO_OFFICE },
  });
  await prisma.user.create({
    data: { name: "Board Observer", email: "viewer@kubera.local", passwordHash, role: Role.VIEWER },
  });

  const depts: { id: string; code: string; hod: SeedUser; members: SeedUser[] }[] = [];
  for (const d of DEPARTMENTS) {
    const dept = await prisma.department.create({ data: { code: d.code, name: d.name } });
    const lc = d.code.toLowerCase();
    const [hodName, m1Name, m2Name] = d.people;
    const mk = (name: string, email: string, role: Role) =>
      prisma.user.create({
        data: { name, email: `${email}@kubera.local`, passwordHash, role, departmentId: dept.id },
      });
    const hod = await mk(hodName, `hod.${lc}`, Role.HOD);
    const m1 = await mk(m1Name, `${lc}.m1`, Role.MEMBER);
    const m2 = await mk(m2Name, `${lc}.m2`, Role.MEMBER);
    await prisma.department.update({ where: { id: dept.id }, data: { hodUserId: hod.id } });
    depts.push({
      id: dept.id,
      code: d.code,
      hod: { ...hod, deptCode: d.code },
      members: [m1, m2].map((u) => ({ ...u, deptCode: d.code })),
    });
  }

  // ── Ticket specs ──
  type Spec = {
    i: number;
    dept: (typeof depts)[number];
    title: string;
    status: TicketStatus;
    priority: Priority;
    ownerId: string;
    createdById: string;
    createdAt: Date;
    progress: number;
    dueDate: Date | null;
    originalDueDate: Date | null;
    noDeadlineReason: string | null;
    blockerReason: string | null;
    completedAt: Date | null;
    validatedById: string | null;
    validatedAt: Date | null;
    confidential: boolean;
    reopenCount: number;
    extensions: { from: Date; to: Date; reason: string; at: Date }[];
  };

  const specs: Spec[] = [];
  depts.forEach((dept, d) => {
    DEPARTMENTS[d].titles.forEach((title, k) => {
      const i = d * 5 + k;
      const status = STATUS_CYCLE[i % 8];
      const priority = PRIORITIES[Math.floor(i / 2) % 4];
      const people = [dept.hod, ...dept.members];
      const createdDaysAgo = 12 + ((i * 7) % 18);
      const s: Spec = {
        i,
        dept,
        title,
        status,
        priority,
        ownerId: people[(k + 1) % 3].id,
        createdById: i % 3 === 0 ? ceoOffice.id : dept.hod.id,
        createdAt: at(-createdDaysAgo, 11),
        progress: 0,
        dueDate: at(5 + k * 2),
        originalDueDate: null,
        noDeadlineReason: null,
        blockerReason: null,
        completedAt: null,
        validatedById: null,
        validatedAt: null,
        confidential: d === 4 && k === 4,
        reopenCount: 0,
        extensions: [],
      };
      switch (status) {
        case "ASSIGNED":
          s.progress = 5;
          break;
        case "IN_PROGRESS":
          s.progress = 20 + ((i * 13) % 60);
          s.dueDate = at(3 + k);
          break;
        case "BLOCKED":
          s.progress = 35;
          s.dueDate = at(2 + k);
          s.blockerReason = "Waiting on vendor quotation and finance sign-off";
          break;
        case "AWAITING_APPROVAL":
          s.progress = 90;
          s.dueDate = at(1 + k);
          break;
        case "ON_HOLD":
          s.progress = 10;
          s.dueDate = null;
          s.noDeadlineReason = "Paused until next quarter budget is approved";
          break;
        case "COMPLETED":
          s.progress = 100;
          s.dueDate = at(-2 - k);
          s.completedAt = at(-3 - k, 16);
          if (priority === "CRITICAL" || priority === "HIGH") {
            s.validatedById = dept.hod.id;
            s.validatedAt = at(-2 - k, 10);
          }
          break;
        case "CANCELLED":
          s.progress = 15;
          s.dueDate = at(-1);
          break;
      }
      specs.push(s);
    });
  });

  const byStatus = (status: TicketStatus) => specs.filter((s) => s.status === status);

  // Overdue: open tickets whose committed deadline has passed (overdue is computed, not a status).
  [byStatus("IN_PROGRESS")[0], byStatus("BLOCKED")[1], byStatus("ASSIGNED")[2], byStatus("AWAITING_APPROVAL")[3]].forEach(
    (s, n) => (s.dueDate = at(-2 - n)),
  );

  // Extended deadlines: originalDueDate preserved, one DeadlineChange per extension.
  const extended: [Spec, { orig: number; step: number; n: number }][] = [
    [byStatus("IN_PROGRESS")[1], { orig: -14, step: 5, n: 2 }], // still overdue after 2 extensions
    [byStatus("IN_PROGRESS")[2], { orig: -10, step: 7, n: 2 }],
    [byStatus("BLOCKED")[2], { orig: -12, step: 6, n: 3 }],
  ];
  const extensionReasons = [
    "Dependency on another department slipped",
    "Scope expanded after CEO review",
    "Vendor delivery delayed",
  ];
  for (const [s, { orig, step, n }] of extended) {
    let due = at(orig);
    for (let e = 0; e < n; e++) {
      const next = new Date(due.getTime() + step * DAY);
      s.extensions.push({ from: due, to: next, reason: extensionReasons[e % 3], at: new Date(due.getTime() - DAY) });
      due = next;
    }
    s.originalDueDate = at(orig);
    s.createdAt = at(orig - 10, 11);
    s.dueDate = due;
  }

  byStatus("IN_PROGRESS")[3].reopenCount = 1;
  // One undated open ticket outside ON_HOLD.
  const undated = byStatus("NEW")[1];
  undated.dueDate = null;
  undated.noDeadlineReason = "Exploratory; deadline to be set after scoping";

  for (const s of specs) {
    if (s.dueDate && !s.originalDueDate) s.originalDueDate = s.dueDate;
  }

  // ── Insert tickets with KN-<DEPT>-<YYYY>-<NNNNN> numbers in creation order ──
  const counters = new Map<string, number>();
  const tickets = new Map<number, { id: string; ticketNo: string }>();
  for (const s of [...specs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const year = new Date(s.createdAt.getTime() + IST_OFFSET).getUTCFullYear();
    const key = `${s.dept.code}:${year}`;
    const seq = (counters.get(key) ?? 0) + 1;
    counters.set(key, seq);
    const ticketNo = `KN-${s.dept.code}-${year}-${String(seq).padStart(5, "0")}`;

    const t = await prisma.ticket.create({
      data: {
        ticketNo,
        title: s.title,
        description: `${s.title} — owned by ${s.dept.code}.`,
        departmentId: s.dept.id,
        ownerId: s.ownerId,
        priority: s.priority,
        status: s.status,
        progress: s.progress,
        dueDate: s.dueDate,
        originalDueDate: s.originalDueDate,
        noDeadlineReason: s.noDeadlineReason,
        blockerReason: s.blockerReason,
        confidential: s.confidential,
        createdById: s.createdById,
        createdAt: s.createdAt,
        completedAt: s.completedAt,
        validatedById: s.validatedById,
        validatedAt: s.validatedAt,
        reopenCount: s.reopenCount,
        extensionCount: s.extensions.length,
      },
    });
    tickets.set(s.i, t);

    const events: Prisma.TicketEventCreateManyInput[] = [
      { ticketId: t.id, actorId: s.createdById, type: "CREATED", at: s.createdAt },
    ];
    if (s.status !== "NEW") {
      events.push({
        ticketId: t.id,
        actorId: s.ownerId,
        type: "STATUS_CHANGED",
        field: "status",
        fromValue: "NEW",
        toValue: s.status,
        reason: s.blockerReason,
        at: new Date(s.createdAt.getTime() + DAY),
      });
    }
    for (const x of s.extensions) {
      events.push({
        ticketId: t.id,
        actorId: s.ownerId,
        type: "DEADLINE_CHANGED",
        field: "dueDate",
        fromValue: x.from.toISOString(),
        toValue: x.to.toISOString(),
        reason: x.reason,
        at: x.at,
      });
    }
    await prisma.ticketEvent.createMany({ data: events });
    await prisma.deadlineChange.createMany({
      data: s.extensions.map((x) => ({
        ticketId: t.id,
        from: x.from,
        to: x.to,
        reason: x.reason,
        requestedById: s.ownerId,
        approvedById: s.dept.hod.id,
        at: x.at,
      })),
    });
    await prisma.activityLog.create({
      data: {
        actorId: s.createdById,
        entity: "Ticket",
        entityId: t.id,
        action: "CREATE",
        diff: { ticketNo, title: s.title, status: s.status, priority: s.priority },
        at: s.createdAt,
      },
    });
  }

  for (const [key, last] of counters) {
    const [departmentCode, year] = key.split(":");
    await prisma.ticketCounter.create({ data: { departmentCode, year: Number(year), last } });
  }

  // ── Co-assignees (incl. cross-department) ──
  const memberOf = (code: string, n: 0 | 1) => depts.find((d) => d.code === code)!.members[n];
  const coAssign: [number, SeedUser, string][] = [
    [2, memberOf("PRD", 0), "Build automated research data feed"], // EDT ticket
    [8, memberOf("PRD", 1), "Playout server configuration"], // BRD
    [17, memberOf("PRO", 0), "Shoot campaign films"], // MKT
    [27, memberOf("PRD", 0), "Integrate access cards with SSO"], // OPS
    [37, memberOf("OPS", 1), "Procure storage hardware"], // PRO
    [12, memberOf("PRD", 1), "Profile upload path"], // PRD (same dept)
    [22, memberOf("HR", 1), "Draft onboarding checklist"], // HR (same dept)
  ];
  await prisma.ticketAssignee.createMany({
    data: coAssign.map(([i, u, responsibility], n) => ({
      ticketId: tickets.get(i)!.id,
      userId: u.id,
      responsibility,
      contributionStatus: n % 3 === 0 ? "DONE" : "IN_PROGRESS",
      progress: n % 3 === 0 ? 100 : 40,
    })),
  });

  // ── Dependencies ──
  await prisma.ticketDependency.createMany({
    data: [
      { ticketId: tickets.get(8)!.id, dependsOnTicketId: tickets.get(13)!.id }, // playout ← SSO
      { ticketId: tickets.get(37)!.id, dependsOnTicketId: tickets.get(26)!.id }, // storage ← vendor renewals
      { ticketId: tickets.get(19)!.id, dependsOnTicketId: tickets.get(39)!.id, resolved: true },
      { ticketId: tickets.get(3)!.id, externalPrerequisite: "Printing vendor confirmation" },
    ],
  });

  // One cancelled ticket marked as a duplicate.
  const cancelled = byStatus("CANCELLED")[0];
  await prisma.ticket.update({
    where: { id: tickets.get(cancelled.i)!.id },
    data: { duplicateOfId: tickets.get(cancelled.i - 1)!.id },
  });

  // ── Comments ──
  await prisma.comment.createMany({
    data: byStatus("BLOCKED").map((s) => ({
      ticketId: tickets.get(s.i)!.id,
      authorId: s.dept.hod.id,
      body: "Escalated to finance; expecting a response by tomorrow.",
      createdAt: at(-1, 15),
    })),
  });

  // ── Decisions (3 pending, one past its deadline) ──
  const decisionSpecs = [
    {
      s: byStatus("BLOCKED")[0],
      question: "Approve additional vendor budget to unblock this work?",
      deadline: at(2),
    },
    {
      s: specs[16],
      question: "Sign the YouTube distribution partnership on revenue-share terms?",
      deadline: at(4),
    },
    {
      s: specs[20],
      question: "Approve two additional senior editor positions above plan?",
      deadline: at(-1),
    },
  ];
  for (const { s, question, deadline } of decisionSpecs) {
    const decision = await prisma.decision.create({
      data: {
        ticketId: tickets.get(s.i)!.id,
        departmentId: s.dept.id,
        requestedById: s.dept.hod.id,
        question,
        businessImpact: "Delivery timeline and quarterly targets depend on this.",
        options: [
          { label: "Approve", detail: "Proceed as proposed" },
          { label: "Defer", detail: "Revisit next quarter" },
        ],
        recommendation: "Approve",
        decisionDeadline: deadline,
        createdAt: at(-3, 12),
      },
    });
    await prisma.activityLog.create({
      data: {
        actorId: s.dept.hod.id,
        entity: "Decision",
        entityId: decision.id,
        action: "CREATE",
        diff: { question },
        at: at(-3, 12),
      },
    });
  }

  // ── Daily reports: last 5 days, every dept; PRD and COM each missed one day ──
  const missed = new Set(["PRD:-3", "COM:-2"]);
  const sectionFor = (s: Spec, day: number): ReportSection => {
    if (s.status === "COMPLETED") return "COMPLETED";
    if (s.dueDate && s.dueDate < at(day) && OPEN.includes(s.status)) return "DELAYED";
    if (s.status === "BLOCKED") return "BLOCKED";
    if (s.status === "NEW" || s.status === "ASSIGNED") return "NEW";
    if (s.status === "IN_PROGRESS") return "IN_PROGRESS";
    return "PENDING";
  };
  for (const dept of depts) {
    for (let day = -5; day <= -1; day++) {
      if (missed.has(`${dept.code}:${day}`)) continue;
      const deptSpecs = specs.filter(
        (s) => s.dept === dept && s.status !== "CANCELLED" && s.createdAt < at(day),
      );
      const items = deptSpecs.map((s) => ({
        ticketId: tickets.get(s.i)!.id,
        ticketNo: tickets.get(s.i)!.ticketNo,
        section: sectionFor(s, day),
        note: s.blockerReason ?? "On track",
        progress: s.progress,
      }));
      const highestPriority: ReportPriority = items.some((x) => x.section === "BLOCKED")
        ? "CRITICAL"
        : items.some((x) => x.section === "DELAYED")
          ? "HIGH"
          : "NORMAL";
      const blockersText = deptSpecs.find((s) => s.blockerReason)?.blockerReason ?? "";
      const nextDayPriorities = deptSpecs
        .filter((s) => OPEN.includes(s.status))
        .slice(0, 2)
        .map((s) => s.title)
        .join("; ");
      // OPS revised yesterday's report once, so it has two revisions.
      const revisions = dept.code === "OPS" && day === -1 ? [1, 2] : [1];
      for (const revision of revisions) {
        const isLatest = revision === revisions.length;
        await prisma.dailyReport.create({
          data: {
            departmentId: dept.id,
            reportDate: dateOnly(day),
            submittedById: dept.hod.id,
            submittedAt: at(day, 18 + revision),
            revision,
            isLatest,
            payload: { items, highestPriority, blockersText, nextDayPriorities },
            highestPriority,
            blockersText,
            nextDayPriorities,
            fillSeconds: 240 + ((dept.code.charCodeAt(0) * 7 - day * 31) % 300),
            items: {
              create: items.map(({ ticketId, section, note, progress }) => ({
                ticketId,
                section,
                note,
                progress,
              })),
            },
          },
        });
      }
    }
  }

  // ── Escalations & notifications ──
  const now = new Date();
  const overdue = specs.filter((s) => s.dueDate && s.dueDate < now && OPEN.includes(s.status));
  await prisma.escalation.createMany({
    data: [
      ...overdue.map((s) => ({
        ticketId: tickets.get(s.i)!.id,
        departmentId: s.dept.id,
        trigger: "DEADLINE_MISSED" as const,
        impact: `${s.title} is past its committed deadline.`,
        requiredAction: "Owner to update plan; HoD to confirm revised date.",
        createdAt: at(-1, 9),
      })),
      ...[...missed].map((key) => {
        const [code, day] = key.split(":");
        return {
          departmentId: depts.find((d) => d.code === code)!.id,
          trigger: "MISSED_REPORT" as const,
          impact: `${code} did not submit the daily report for ${dateOnly(Number(day)).toISOString().slice(0, 10)}.`,
          requiredAction: "HoD to submit the missing report.",
          status: "ACK" as const,
          createdAt: at(Number(day) + 1, 9),
        };
      }),
    ],
  });
  await prisma.notification.createMany({
    data: overdue.map((s) => ({
      userId: s.ownerId,
      kind: "DEADLINE_MISSED",
      title: `Overdue: ${tickets.get(s.i)!.ticketNo}`,
      body: s.title,
      link: `/tickets/${tickets.get(s.i)!.ticketNo}`,
      sentAt: at(-1, 9),
    })),
  });

  const counts = {
    users: await prisma.user.count(),
    tickets: await prisma.ticket.count(),
    reports: await prisma.dailyReport.count(),
    decisions: await prisma.decision.count(),
  };
  console.log(`seed: done (CEO ${ceo.email}) ${JSON.stringify(counts)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
