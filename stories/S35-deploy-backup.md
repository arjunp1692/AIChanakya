# S35 — Deployment, backup and restore
model: sonnet · deps: S26 · PRD: §11 Availability, Recovery, Security

## Goal
Production-ready packaging with tested backup and restore.

## Scope
- `Dockerfile` (multi-stage, Next standalone) + `docker-compose.prod.yml` (db, app, worker, volume for uploads); HTTPS via reverse proxy note (Caddy example).
- `scripts/backup.sh` / `backup.ps1`: `pg_dump` + uploads tarball with timestamp, retention N days; `scripts/restore.*`.
- `docs/OPERATIONS.md`: deploy, env vars, backup schedule (cron/Task Scheduler), restore procedure, proposed uptime target (99.5% business hours), secrets handling.
- Security headers (CSP basic, HSTS in prod), secure cookies, rate-limit on login.

## Acceptance criteria
1. `docker compose -f docker-compose.prod.yml up` serves the app and worker.
2. Backup → drop DB → restore → app shows the same ticket count.
3. Login rate limit kicks in after 10 failed attempts/min.

## Validation
- Run the backup/restore cycle and compare `SELECT count(*) FROM "Ticket"` before/after; curl login loop.

## Implementation notes
_(implementer fills, ≤6 lines)_
