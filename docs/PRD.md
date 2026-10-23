# Chanakya AI — PRD (markdown copy of ChanakyaAIPRD.docx, v1.0, 15 Oct 2026)

> Source of truth is the .docx. Stories cite sections as PRD §N. Grep a section instead of reading this whole file.

- Chanakya AI
- Product Requirements Document (PRD)
- Product: CEO Office Intelligence & Task Management System | Organisation: Kubera Now | Version 1.0 | Date: 15 October 2026
- Chanakya AI is a centralized, AI-powered operating system for the CEO’s Office of Kubera Now, designed to bring all departmental tasks, accountability, execution updates, escalations and management reporting into one unified platform.
- The system will convert daily departmental reports into a live ticket-management workflow and an automated Weekly CEO Dashboard, giving the CEO visibility into what was assigned, what was completed, what is delayed, who is responsible and which decisions require leadership intervention.

## 1. Product vision

- One organisation. One source of truth. Complete executive visibility.
- Chanakya AI will function as the digital command centre for the CEO’s Office, connecting eight departments through a structured, ticket-wise task management system.
- Its primary objective is to shift Kubera Now from fragmented reporting and manual follow-ups to a system of measurable accountability, real-time monitoring and AI-assisted decision-making.
- Core outcomes
- Centralise all departmental tasks in one platform.
- Make every task traceable through a unique ticket ID.
- Require each Head of Department (HoD) to submit an end-of-day task report.
- Support multiple assignees and cross-department dependencies.
- Give the CEO real-time visibility into task progress, blockers and deadlines.
- Automatically generate daily, weekly and department-wise performance reports.
- Identify recurring delays, operational risks and decisions pending with the CEO.

## 2. Departments covered

- Editorial
- News, research, scripts and editorial deliverables
- Broadcasting
- Bulletins, transmission and broadcast operations
- Product
- Platform development, automation and technology
- Marketing
- Campaigns, distribution, growth and partnerships
- HR
- Hiring, attendance, onboarding and people matters
- Operations
- Facilities, procurement, administration and execution
- Communications
- PR, corporate communication and stakeholder relations
- Production
- Studio, shoots, editing and content delivery
- Each department will have its own workspace, task ownership, reporting responsibilities, performance metrics and access permissions, while the CEO will have a consolidated view across all eight departments.

## 3. User roles and access

- Role
- Primary responsibilities
- CEO
- Organisation-wide dashboard, task visibility, escalations, approvals and decisions
- CEO Office / Administrator
- Monitor submissions, coordinate interdepartmental work, review escalations and maintain reporting discipline
- Head of Department
- Submit daily reports, assign tasks, validate completion and manage departmental performance
- Task Owner
- Execute the task, update progress, record blockers and submit completion evidence
- Co-assignee
- Complete assigned contributions and update their own progress
- Viewer / Leadership
- View authorised reports, tasks and performance summaries
- Accountability rule: Every ticket must have one clearly identified primary owner. Co-assignees can share execution responsibilities, but they must not make ownership ambiguous.

## 4. Core product workflow

- The system should follow a single, traceable workflow from daily task reporting to executive review.
- 1. HoD submits end-of-day report
- New tasks, progress, completions, pending work, blockers and next-day priorities
- 2. Chanakya AI creates or updates tickets
- Unique ticket ID, owner, co-assignees, department, priority and deadline
- 3. Live execution tracking
- Progress updates, comments, evidence, dependencies and automated alerts
- 4. Escalation and CEO intervention
- Overdue tickets, repeated delays, critical blockers and decisions required
- 5. Automated CEO Dashboard
- Real-time organisational view and consolidated weekly performance report
- Important workflow principle
- The daily report should not remain a separate document that must be manually consolidated. It should be the input into the central task database.
- When an existing task is reported again, the system should update the existing ticket instead of creating a duplicate. New tasks should receive new ticket IDs. All updates must retain their history and timestamps.

## 5. Functional requirements

- Priority definitions: P0 = essential for launch; P1 = important; P2 = enhancement.

### FR-01 — Ticket Management
- P0
- Every task must have a unique ID, title, description, originating department, primary owner, co-assignees, priority, creation date, due date, status and update history.
- Acceptance: No task can enter active tracking without a unique ticket ID and a primary owner.

### FR-02 — End-of-Day Reporting
- P0
- HoDs submit a structured report with tasks completed today, tasks in progress, newly assigned tasks, pending tasks, delayed tasks, blockers and next-day priorities.
- Acceptance: The system identifies missing daily submissions and carries forward unresolved tasks without losing their original deadlines or history.

### FR-03 — Multi-Assignee Coordination
- P0
- Assign a primary owner and multiple co-assignees across departments. Record individual responsibilities, contribution status and dependencies between tickets.
- Acceptance: Each co-assignee can update their contribution, while the main ticket remains visible to the originating department and CEO.

### FR-04 — Real-Time Task Monitoring
- P0
- Display the latest task status, progress, last updated time, comments, attachments, deadline changes and blocker updates.
- Acceptance: A permitted status update becomes visible on the central dashboard without requiring the CEO to request a new report.

### FR-05 — Alerts and Escalations
- P0
- Trigger notifications for overdue tasks, approaching deadlines, blocked tasks, missed reports, critical issues and pending CEO decisions.
- Acceptance: Every escalation identifies the ticket, owner, impact, required action and escalation timestamp.

### FR-06 — Weekly CEO Dashboard
- P0
- Automatically aggregate daily task data into weekly totals, completion rates, pending tasks, overdue work, departmental performance, recurring delays and decision requests.
- Acceptance: The CEO can select a reporting period and drill down from a summary metric into its underlying tickets.

### FR-07 — AI Executive Intelligence
- P1
- Summarise reports, detect repeated delays, flag inconsistent updates, identify cross-functional bottlenecks and draft recommendations for CEO review.
- Acceptance: AI-generated insights reference the underlying tickets and are distinguishable from verified system facts.

### FR-08 — Permissions and Audit Trail
- P0
- Enforce role-based access, maintain a timestamped activity history and record changes to owners, deadlines, priorities, status and CEO decisions.
- Acceptance: Users cannot edit records outside their permissions, and material changes remain traceable.

## 6. Weekly CEO Dashboard — specification

- This is the principal management interface of Chanakya AI.
- CEO Command Centre
- Illustrative dashboard · Sample data only
- Weekly view
- This weekLast weekMonth
- Department filter
- All departments
- Tasks assigned
- 120
- Tickets created in period
- Completed
- 75%
- Completion rate
- Pending
- 24
- Open tickets from selected scope
- Delayed
- 12
- Past-due open tickets
- CEO attention required
- Critical issues
- Blocked deliverables, operational risks and high-priority escalations.
- 3
- Repeated delays
- Tasks, dependencies or owners with recurring deadline slippage.
- 5
- CEO decisions pending
- Approvals, resource allocation or decisions needed to unblock work.
- 4
- Explore dashboard sections
- Executive overview
- Department-wise performance
- Delayed and recurring tasks
- CEO decisions and escalations
- CEO decision register
- List each pending decision, its requesting department, business impact, options, decision deadline and current status.
- The sample values above are placeholders for demonstrating the interface, not actual Kubera Now performance data. A production dashboard must calculate all values from verified ticket records.
- Required weekly metrics and calculation rules
- Metric
- Proposed calculation
- Total tasks assigned
- Unique tickets created during the reporting period
- Completed
- Tickets completed during the reporting period
- Completed %
- Tickets completed from the period's assigned cohort ÷ total tickets in that cohort × 100
- Pending %
- Tickets still open from the period's assigned cohort ÷ total tickets in that cohort × 100
- Delayed tasks
- Open tickets whose effective due date has passed
- On-time completion
- Tickets completed on or before their applicable deadline ÷ tickets completed × 100
- Department performance
- On-time completion, workload, overdue rate and reporting compliance
- Repeated delays
- Tickets or recurring work items with repeated deadline slippage
- Critical issues
- Open critical-priority tickets or escalations meeting defined risk criteria
- CEO decisions pending
- Tickets awaiting a recorded CEO decision or approval
- Reporting integrity requirements:
- The dashboard must distinguish tasks created this week from tasks completed this week and tasks carried forward from earlier weeks.
- Completion and pending percentages must use the same clearly identified task cohort so the figures remain meaningful.
- Delayed tasks must be calculated using due dates and status history, not merely an HoD's self-reported label.
- Reopened tasks, cancelled tasks and duplicate tickets must have explicit reporting rules.
- Department comparisons should account for workload and task complexity; raw completion counts alone are not a fair performance measure.

## 7. Daily reporting interface

- Each HoD should have a standard end-of-day submission form. The form should take as little time as possible and automatically populate the ticket database.
- HoD Daily Report
- Interactive prototype of the proposed submission form
- DepartmentEditorial
- Reporting date15/10/26
- Head of Department
- New and ongoing tasks
- Normal Shoot
- Tasks completed today
- Hello
- Blockers and management support required
- Nothing
- Highest priority requiring attention
- Normal — routine execution
- High — deadline or dependency risk
- Critical — immediate escalation
- Generate report preview
- Report preview requested
- The information has been passed to the conversation to prepare a structured report. This prototype does not save the submission, create tickets in a database or notify the CEO.
- Production submission requirements
- In the actual product, the form must also support:
- Linking to existing tickets or creating new tickets.
- Primary assignee and multiple co-assignees.
- Individual deadlines, priority, dependencies and attachments.
- Automatic carry-forward of unfinished tasks.
- A mandatory reason when a task is delayed or a deadline is changed.
- CEO decision requests with a clear recommendation and due date.
- Submission timestamps and a record of who submitted or edited the report.

## 8. Ticket data model

- Each ticket should use a standard data structure that can support dashboards, audit trails and AI analysis.
- Field
- Purpose
- Ticket ID
- Unique identifier, e.g. KN-OPS-2026-00125
- Title and description
- What needs to be delivered
- Department
- Originating or accountable department
- Primary owner
- One directly accountable person
- Co-assignees
- People contributing to execution
- Priority
- Critical, High, Medium or Low
- Status
- Current workflow stage
- Created at
- Original ticket creation timestamp
- Due date
- Current committed deadline
- Original due date
- Preserved for delay analysis
- Progress
- Percentage or defined stage of completion
- Dependencies
- Linked tickets or external prerequisites
- Blocker / reason
- Why work is stopped or delayed
- Evidence
- Documents, links or proof of completion
- CEO decision
- Decision requested, owner and outcome
- Update history
- Timestamped changes and comments
- Closure details
- Completion date and validation
- The product should also maintain a separate activity log and daily-report record. This prevents subsequent edits from erasing the historical state used in weekly reporting.

## 9. Ticket status and escalation rules

- Standard ticket lifecycle
- New
- Assigned
- In Progress
- Blocked
- In Progress
- Completed
- Additional statuses: Awaiting Approval, On Hold and Cancelled. Overdue should be a calculated flag that can coexist with an open status, not a replacement for the actual workflow status.
- Recommended escalation policy
- Trigger
- System action
- Deadline approaching
- Notify owner and co-assignees
- Deadline missed
- Mark overdue, alert owner and HoD
- Repeated missed deadlines
- Flag recurring delay and notify CEO Office
- Critical blocker
- Escalate immediately to the authorised leadership channel
- CEO decision requested
- Add to the decision register and track decision age
- Daily report not submitted
- Remind HoD and flag reporting non-compliance
- Deadline extended
- Preserve original date, revised date, reason and approver
- Task marked completed
- Capture completion timestamp and evidence; request validation if required
- The exact reminder windows, escalation thresholds and notification channels should be configurable by the CEO Office.

## 10. AI intelligence layer

- Chanakya AI should be more than a conventional task tracker. Its intelligence layer should transform operational data into actionable management insights.
- Daily Executive Brief
- A concise summary of major completions, important new tasks, overdue items, key blockers and decisions requiring attention.
- Delay Pattern Detection
- Identify recurring delays by ticket, work type, dependency or process. Distinguish evidence-based patterns from AI-generated hypotheses.
- Cross-Department Intelligence
- Highlight situations where Editorial is waiting on Production, Marketing is waiting on Product, or multiple departments are dependent on the same approval.
- CEO Decision Assistant
- Summarise the issue, business impact, options, recommendation, responsible department and decision deadline.
- Sample AI-generated insight
- Production bottleneck detected: Three high-priority deliverables depend on the same pending studio resource. If the dependency remains unresolved, the delivery dates of linked Editorial and Marketing tasks may be affected.
- Suggested action: Ask Operations and Production to confirm resource availability and submit a revised execution plan. Escalate to the CEO only if a management decision is required.
- This is an illustrative insight, not a finding about Kubera Now's actual operations.
- AI guardrails: Chanakya AI must not invent task progress, assign blame without evidence, change deadlines autonomously, mark tasks completed without the defined verification process or make CEO-level decisions on its own. Recommendations must remain traceable to source records.

## 11. Non-functional requirements

- Area
- Requirement
- Performance
- Common dashboard and ticket views should load quickly under normal business usage
- Real-time updates
- Use push-based updates or equivalent near-real-time synchronisation
- Availability
- Define a production uptime target and backup procedures before launch
- Security
- Role-based permissions, secure authentication and protected data transmission
- Auditability
- Record status changes, ownership changes, deadline revisions and approvals
- Scalability
- Support all eight departments and future teams without redesigning the workflow
- Usability
- Responsive desktop and mobile interface with minimal daily reporting effort
- Search
- Search tickets by ID, title, department, assignee, status and date
- Data integrity
- Prevent duplicate submissions and preserve original task history
- Export
- Support CSV/XLSX data export and PDF management reports
- Recovery
- Scheduled backups and documented restoration procedures
- Privacy
- Restrict confidential HR, personnel and leadership records to authorised users

## 12. Proposed product architecture

- The recommended system has six logical layers.
- 01
- User Interface
- CEO dashboard · HoD workspace · Ticket views · Mobile interface
- 02
- Workflow Engine
- Assignment · Status transitions · Deadlines · Dependencies · Escalations
- 03
- Application & API Layer
- Permissions · Validation · Business rules · Integrations
- 04
- Central Database
- Tickets · Users · Reports · Comments · Activity logs · Decisions
- 05
- AI Intelligence Layer
- Summaries · Delay detection · Cross-team analysis · Recommendations
- 06
- Notifications & Reporting
- Daily briefs · Weekly reports · Email / approved messaging channels
- Technology choices should be finalised after reviewing Kubera Now's existing IT infrastructure, user accounts, reporting tools, security needs and integration requirements. The PRD specifies the required capabilities rather than mandating a particular technology stack.

## 13. MVP scope and implementation roadmap

- A phased launch will reduce complexity and allow the CEO Office to validate reporting discipline before introducing advanced AI capabilities.
- Phase 1
- Weeks 1–2
- Requirements and workflow design
- Finalise roles and access permissions.
- Define ticket fields and status transitions.
- Agree reporting cut-off times and escalation rules.
- Map department-level workflows.
- Phase 2
- Weeks 3–5
- Core task-management MVP
- Build ticket creation, assignment and updates.
- Build the HoD daily reporting form.
- Enable co-assignees, comments and attachments.
- Implement user permissions and audit history.
- Phase 3
- Weeks 6–7
- CEO dashboard and alerts
- Automate daily and weekly aggregation.
- Implement overdue and critical issue alerts.
- Build departmental scorecards and the CEO decision register.
- Validate metrics against actual ticket records.
- Phase 4
- Weeks 8–10
- AI, pilot and rollout
- Introduce executive summaries and delay analysis.
- Pilot with selected departments.
- Test permissions, escalations and reporting accuracy.
- Roll out to all eight departments and train users.
- Indicative timeline: 8–10 weeks, subject to staffing, platform selection, integration requirements and development capacity. This is a planning estimate, not a committed delivery date.

## 14. Success metrics

- The product should be measured on both adoption and operational improvement.
- KPI
- Initial target
- Daily HoD reporting compliance
- ≥ 95%
- Active tasks with a primary owner
- 100%
- Tickets with a recorded deadline or documented exception
- 100%
- Weekly dashboard generated automatically
- 100% of reporting cycles
- Material task updates recorded in the system
- ≥ 95%
- Critical escalations captured in the system
- 100%
- Duplicate tickets in the active workflow
- Minimise and monitor
- Reduction in manual reporting time
- Establish baseline, then target ≥ 50%
- Reduction in overdue tasks
- Establish baseline, then target ≥ 25% over the first 90 days
- Targets are proposed starting points. The CEO Office should validate them against a baseline period before treating them as formal performance commitments.

## 15. Key risks and mitigation

- Risk
- Mitigation
- HoDs submit reports late
- Automated reminders, submission compliance dashboard and escalation rules
- Tasks are reported without meaningful updates
- Require specific deliverables, status changes and blocker explanations
- Teams create duplicate tickets
- Match reports to existing tickets and require confirmation before duplication
- Co-assignees dilute accountability
- Maintain one primary owner with separately tracked contributions
- Deadlines are repeatedly extended
- Preserve original deadlines and require reasons and authorised approvals
- AI produces misleading insights
- Ground outputs in source tickets, show evidence and require human validation
- CEO receives excessive notifications
- Use priority-based alerts and a consolidated daily executive brief
- Sensitive information becomes visible across departments
- Enforce role-based access and field-level restrictions where needed

## 16. Acceptance criteria for launch

- Chanakya AI should be considered ready for initial production use only when the following conditions are met.
- Launch readiness checklist
- 0 of 10
- All eight departments and authorised users are configured.
- Each ticket has a unique ID, primary owner, status and due date or documented exception.
- HoDs can submit end-of-day reports and link them to existing tickets.
- Co-assignees can update their contributions without overriding other users' permissions.
- Task updates, deadline changes and completion events are recorded in the activity history.
- Overdue tasks and critical blockers trigger the configured notifications.
- Weekly metrics reconcile with the underlying ticket records.
- The CEO can drill down from each dashboard metric to the relevant tickets.
- Department permissions, backups and recovery procedures have been tested.
- AI summaries clearly distinguish verified facts from recommendations.
- Copy checklist

## 17. Decisions required from the CEO

- Before development begins, the CEO Office should confirm the following product decisions.
- 1. Preferred implementation approach
- Custom web application — full control and extensibility
- Low-code platform — faster initial deployment
- Extend existing internal tools where practical
- 2. Primary notification channel
- Email
- WhatsApp via an approved business integration
- In-app notifications
- In-app plus email and/or WhatsApp
- 3. Daily reporting cut-off
- 6:00 PM
- 7:00 PM
- 8:00 PM
- 9:00 PM
- 4. Task completion validation
- Task owner marks complete; system records it immediately
- HoD validates completion for departmental tasks
- Validation required only for selected critical tasks
- 5. Cross-department visibility
- All departments can see shared tickets and relevant dependencies
- Departments see only their own tickets; CEO Office has consolidated access
- Hybrid access based on ticket, role and confidentiality
- Refine PRD with these decisions
- Final product definition
- Chanakya AI is the CEO Office Operating System for Kubera Now.
- Its foundation is a central ticket database, disciplined end-of-day reporting, clear ownership, real-time updates, transparent escalation and an automatically generated Weekly CEO Dashboard. AI adds executive summaries, delay detection and decision support on top of verified operational data.
- The recommended first release should prioritise reliable ticket management and reporting before advanced AI. If the underlying tasks, deadlines and ownership records are accurate, Chanakya AI can become the single source of truth for the CEO and the eight departmental HoDs.
