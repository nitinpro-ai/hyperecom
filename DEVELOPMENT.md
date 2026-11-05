# Local Development

## Prerequisites
- Node.js ≥ 20 (repo developed on 26)
- pnpm ≥ 12 (`npm i -g pnpm`)
- Docker Desktop (for the local database stack)

## First run

```bash
pnpm install            # install all workspace dependencies
docker compose up -d    # start postgres(postgis) + redis + minio + mailpit
pnpm db:generate        # generate Prisma client
pnpm db:migrate:dev     # apply migrations (needs db container up)
pnpm db:seed            # seed baseline (geography seed lands in build Step 2)
```

## Run the apps

```bash
pnpm dev:api      # NestJS API      → http://localhost:4000/v1/health
pnpm dev:web      # marketplace     → http://localhost:3000
pnpm dev:seller   # seller portal   → http://localhost:3001
pnpm dev:admin    # admin portal    → http://localhost:3002
```

Or everything at once: `pnpm dev`

## Verify (CI runs the same)

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## What's implemented so far

Follow **`docs/START-HERE.md` §3** — the build sequence tracks exactly which
Steps (0–18) and modules (M01–M32) are complete. Currently: **Step 1 scaffold**.
