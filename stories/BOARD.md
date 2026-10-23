# Story board

Status: `Todo` · `In Progress` · `Done` · `Blocked`. Updated by `/story-implement` and `/story-run`.
Pick next: `/story-next`. One story per session, then `/clear`.

| ID | Title | Phase | PRD | Model | Deps | Status |
|---|---|---|---|---|---|---|
| S01 | Project scaffold and tooling | A | §12 | sonnet | — | Todo |
| S02 | Core data model and seed data | A | §8 | opus | S01 | Todo |
| S03 | Authentication and login | A | §3 | sonnet | S02 | Todo |
| S04 | Permission policy and app shell | A | FR-08 | opus | S03 | Todo |
| S05 | Audit log service and ticket ID generator | A | FR-01 | sonnet | S02 | Todo |
| S06 | Create ticket | B | FR-01 | sonnet | S04, S05 | Todo |
| S07 | Ticket list, search and filters | B | §11 | sonnet | S06 | Todo |
| S08 | Ticket detail, edit and comments | B | FR-04 | sonnet | S07 | Todo |
| S09 | Status workflow state machine | B | §9 | opus | S08 | Todo |
| S10 | Deadline changes with reason and approval | B | §9 | sonnet | S09 | Todo |
| S11 | Co-assignees and contributions | B | FR-03 | sonnet | S09 | Todo |
| S12 | Ticket dependencies | B | FR-03 | sonnet | S09 | Todo |
| S13 | Attachments, evidence and completion validation | B | §8 | sonnet | S09 | Todo |
| S14 | HoD daily report form | C | FR-02 | sonnet | S11, S12 | Todo |
| S15 | Report submission → ticket updates | C | FR-02 | opus | S14, S10, S13 | Todo |
| S16 | Carry-forward and reporting compliance | C | FR-02 | sonnet | S15 | Todo |
| S17 | Duplicate ticket detection | C | §15 | sonnet | S15 | Todo |
| S18 | Real-time updates | D | FR-04 | sonnet | S09 | Todo |
| S19 | Notification centre and channels | D | FR-05 | sonnet | S18 | Todo |
| S20 | Scheduler and escalation engine | D | FR-05 | opus | S19, S16 | Todo |
| S21 | Escalations list and handling | D | FR-05 | sonnet | S20 | Todo |
| S22 | CEO decision register | D | §6 | sonnet | S15, S19 | Todo |
| S23 | Metrics calculation service | E | FR-06 | opus | S13, S16, S17, S22 | Todo |
| S24 | CEO Command Centre dashboard | E | FR-06 | sonnet | S23, S18 | Todo |
| S25 | Department scorecards and delay views | E | §6 | sonnet | S24 | Todo |
| S26 | Automatic weekly report snapshot | E | FR-06 | sonnet | S23, S20 | Todo |
| S27 | CSV/XLSX and PDF exports | E | §11 | sonnet | S24, S26 | Todo |
| S28 | AI service layer and guardrails | F | FR-07 | opus | S23 | Todo |
| S29 | Daily Executive Brief | F | §10 | sonnet | S28, S20 | Todo |
| S30 | Delay patterns and cross-dept bottlenecks | F | §10 | opus | S28, S12, S25 | Todo |
| S31 | CEO Decision Assistant | F | §10 | sonnet | S28, S22 | Todo |
| S32 | AI-assisted report entry (P2) | F | §7 | sonnet | S28, S17 | Todo |
| S33 | Admin: users, departments and settings | G | §17 | sonnet | S20 | Todo |
| S34 | Mobile and usability pass | G | §11 | sonnet | S24, S16 | Todo |
| S35 | Deployment, backup and restore | G | §11 | sonnet | S26 | Todo |
| S37 | Inconsistent update detection | F | FR-07 | sonnet | S30, S29 | Todo |
| S38 | Success KPI tracking | E | §14 | sonnet | S26 | Todo |
| S36 | Launch readiness verification | G | §16 | opus | S01–S35, S37, S38 | Todo |

S37/S38 were added after the PRD coverage review; S36 stays last.

**Working-product milestones:** after S16 the core ticket + daily reporting app is usable for a pilot · after S27 the CEO dashboard is complete (PRD MVP) · after S32 + S37 the AI layer is in · S36 confirms launch readiness.
