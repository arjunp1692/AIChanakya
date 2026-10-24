# Chanakya AI

CEO Office task/ticket system for Kubera Now. Requires Node 22, pnpm 9, Docker.

## Quick start
```sh
pnpm install
cp .env.example .env            # set AUTH_SECRET
docker compose up -d db         # Postgres 16 on :5432
pnpm db:reset                   # migrate + seed
pnpm dev                        # http://localhost:3000 (health: /api/health)
pnpm worker                     # background jobs, separate terminal
```
