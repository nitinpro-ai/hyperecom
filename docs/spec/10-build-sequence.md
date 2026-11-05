# 10 — Build Sequence (step-by-step)

> This is the "how do I start coding" document. Follow steps in order; each has
> **Do** (concrete actions/commands) and **Verify** (must pass before moving on).
> Feed one step at a time to an AI coding agent along with the relevant spec docs.

## Step 0 — Prerequisites (business/external, start Week 1)

| # | Do | Verify | Lead time |
|---|----|--------|-----------|
| 0.1 | Register India entity; open current account | Incorporation certificate | weeks |
| 0.2 | Buy `apnacity.com`; add to Cloudflare; `A` apex + CNAME `*.apnacity.com` | `dig bijnor.apnacity.com` resolves | hours |
| 0.3 | Wildcard cert for `*.apnacity.com` (Cloudflare Universal/Advanced or ACME DNS-01) | TLS OK on a test subdomain | hours–days |
| 0.4 | Cashfree/Razorpay merchant onboarding → **sandbox keys first** | Sandbox dashboard access | days–weeks |
| 0.5 | DLT registration: sender ID + all templates (list: `11-appendix` §3) | DLT portal shows APPROVED | days–weeks — **longest pole, start first** |
| 0.6 | WhatsApp Business API + template approval | Approved templates | days–weeks |
| 0.7 | Google Maps / Mapbox key (geocoding + distance) | Test geocode call | hours |
| 0.8 | GitHub org + repo + Environments (staging/prod secrets) | CI can run | hours |
| 0.9 | CA/advisor engaged for GST/TCS config (needed before Phase 5) | Written rate config | weeks |

## Step 1 — Scaffold the monorepo (S0, day 1–3)

**Do:**
```bash
mkdir apnacity && cd apnacity
git init && pnpm init
# pnpm-workspace.yaml listing apps/* packages/* infrastructure/*
pnpm add -Dw turbo typescript prettier eslint
npx create-next-app@latest apps/web          # TS, Tailwind, App Router
npx create-next-app@latest apps/seller-portal
npx create-next-app@latest apps/admin-portal
nest new apps/api --strict
mkdir -p packages/{ui,shared-types,api-client,validation,db,events,config}
mkdir -p infrastructure/{docker,monitoring,terraform}
mkdir -p docs/{spec,adr,runbooks} scripts tests
```
- Copy this spec set into `docs/spec/`; create `.env.example` from `11-appendix` §5.
- `docker-compose.yml`: `db` (postgis/postgis:16-3.4), `redis:7`, `minio`,
  `mailpit`, plus app containers (profiles).
- `turbo.json` tasks: `build`, `lint`, `test`, `e2e`, `db:migrate`, `db:seed`.
- `packages/config`: Zod env schema — boot fails if a var is missing/invalid.

**Verify:** `docker compose up -d db redis minio` healthy; `pnpm turbo build`
green; clean-clone `pnpm i` works; strict TS + ESLint across packages.

## Step 2 — Database foundation (S0, day 3–5)

**Do:** implement `03` §2–§3 tables (geography, identity, tenancy) in Prisma.
Raw migrations: `CREATE EXTENSION postgis; pg_trgm; ltree;` + RLS policies
(03 §14) for every tenant table created. Seed: India geography (sources:
`11-appendix` §6) + demo customer/seller/admin/rider.

**Verify:** `pnpm db:migrate && pnpm db:seed`; `SELECT count(*) FROM cities` > 0;
**RLS check** — app role without `app.current_tenant` sees 0 rows in `shops`.

## Step 3 — CI pipeline (S0, day 5)

**Do:** GitHub Actions per `11-appendix` §4 (lint → typecheck → unit →
integration → build → deploy staging on `main`).

**Verify:** PR triggers all checks; deliberately broken lint fails the PR.

## Step 4 — Auth + RBAC + tenancy skeleton (S1)

**Do:** `05` M1/M2/M6 — OTP (hashed, Redis TTL, DLT provider interface with
mailpit in dev), JWT 15 min + rotating refresh, `RolesGuard` + `TenantGuard`,
`GET /internal/resolve-tenant?host=` with HMAC reply; `apps/web` middleware
parses host → resolve → inject `x-tenant-slug` + `x-tenant-proof`.

**Verify (CI tests):** OTP request→verify→token; 5 wrong OTPs → lockout;
refresh reuse → family revoked; wrong role → 403; `Host: bagga-cloth…` → tenant
header present; unknown host → 404 (not crash).

## Step 5 — Seller onboarding + shop + domains (S2–S3)
Per `05` M4/M5/M6 and `06` §6.
**Verify:** register → KYC upload (scanned clean) → admin approves → shop +
`shop_domains` rows created; unknown slug 404; **slug race test** (two concurrent
creates — exactly one wins).

## Step 6 — Media pipeline (S3)
Per `05` M10.
**Verify:** signed-URL upload → 256/512/1024 WebP derivatives < 10 s; MIME-spoof
(`.php` renamed `.jpg`) rejected; KYC docs in private bucket, not public.

## Step 7 — Product wizard + listings + bulk import (S4)
Per `05` M7/M8, `06` §5.
**Verify:** publish enforces category `attribute_schema`; `price <= mrp`;
500-row CSV import reports row-level errors; **usability test: 3 real
shopkeepers, 10 products each, < 15 min unaided, Hindi UI.**

## Step 8 — Inventory engine (S6)
Per `05` M9, `03` §5.
**Verify:** 100 parallel reservations on stock=10 → exactly 10 succeed; TTL
release restores availability; `stock_movements` reconciles to `stock` nightly.

## Step 9 — Storefront + marketplace + PDP (S7)
Per `05` web section.
**Verify:** `{slug}.apnacity.com` renders branded storefront; PDP shows offers
from ≥ 3 shops **for the same variant**; per-tenant sitemap/robots/JSON-LD pass
Rich Results test.

## Step 10 — Search (S8)
Per `05` M11.
**Verify:** relevance golden set; filters exact; typo "nkie shoes" finds Nike;
p95 < 300 ms on 50k-listing seed.

## Step 11 — Cart + checkout + payments test-mode (S9)
Per `05` M12/M13/M15; sequence diagram `11-appendix` §1.
**Verify:** 3-shop cart → quote (per-shop fees) → intent → sandbox payment →
webhook → parent + 3 children `PLACED`; **replayed webhook ignored**; Idempotency
replay returns original order; stock drift → 422 per-item detail.

## Step 12 — OMS + timers (S10)
Per `06` §1–2, §8.
**Verify:** every legal/illegal transition tested; 10-min accept timeout
auto-rejects + refunds; partial cancel recomputes totals.

## Step 13 — Delivery + riders (S11)
Per `05` M17/M18, `06` §7.
**Verify:** READY → job → best-scored rider; 60-s offer timeout → next rider;
OTP wrong 3× → failed; 2 failures → return-to-seller job; seller-self mode uses
same job rows.

## Step 14 — Notifications + returns + support (S12)
Per `05` M19/M22/M23.
**Verify:** order → seller push+SMS < 5 s p95; SMS without DLT template id
**fails closed**; return window expiry blocks request; inspection-failed →
refund frozen + ticket.

## Step 15 — Ledger + settlements + invoicing (S13–S14)
Per `05` M16; worked example `11-appendix` §2.
**Verify:** simulated week (orders + refunds + COD) — debits=credits per
transaction; **ledger == gateway report to the paisa**; T+2 batch + PDF
statement; two-person payout release enforced.

## Step 16 — Admin portal + analytics (S15)
Per `05` M24/M25.
**Verify:** approval queues, ops console with full `order_events` timeline;
commission change → next order uses new rate (audited); seller sees only own
data (isolation tests).

## Step 17 — Mobile apps (S16–S18)
Per `05` mobile section.
**Verify:** scripted journeys on real Android + iOS for all 3 apps; rider
airplane-mode test (3 offline status updates → sync, no loss/dupes); UPI intent
deep link; TestFlight/Play internal distribution.

## Step 18 — Hardening + pilot (S19–S20)
Per `09` §1, §6.
**Verify:** k6 load test meets 09 §1 targets (record in ADR); pen-test
criticals/highs fixed; DR drill ≤ 1 h; **Bijnor pilot checklist (09 §6) all
checked**; first 10 real orders settle correctly.

## Golden rule for every step

> One step = one or more PRs. A PR merges only if: tests green + spec updated
> (`03`/`04`/`05`/`06` in the same PR) + no fake data + demo-able. Never start
> a new step with a broken previous step.

