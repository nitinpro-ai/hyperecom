# APNACITY / HYPERECOM — PROJECT TRACKING & AGENT HANDOFF

> **Purpose:** any AI model, agent, or developer can pick up this project from
> exactly where it stands by reading this file first. It is the operational
> memory of the build. **Rule: every work session updates this file + commits.**
> Last updated: 2026-11-05

## 1. Read this first (order)

1. `docs/START-HERE.md` — entry point + project state snapshot
2. **This file** — detailed tracking below
3. `docs/COMPLETE-BUILD-GUIDE.md` — THE full spec (32 modules, Steps 0–18)
4. `infrastructure/CLUSTER.md` — dev cluster state + day-2 commands
5. `docs/spec/00-README.md` — decision log D-001…D-016 + deep reference index

## 2. Project identity

- **Product:** ApnaCity — hyperlocal multi-vendor marketplace (city-first, local
  shops, price comparison, local delivery, auto shop storefronts)
- **Repo:** https://github.com/nitinpro-ai/hyperecom (clone: `~/work/hyperecom`)
- **Dev environment:** homelab MicroK8s @ 192.168.2.224 (see `infrastructure/CLUSTER.md`)
- **Stack:** pnpm+Turborepo monorepo · NestJS API · Next.js 15 ×3 web apps ·
  Expo mobile (Phase 6) · PostgreSQL 16+PostGIS+Prisma · Redis/BullMQ · MinIO ·
  Kubernetes deploy (D-016) · local Docker Compose for pure-local dev

## 3. Progress tracker (build sequence — COMPLETE-BUILD-GUIDE PART III)

| Step | Scope | Status | Notes |
|------|-------|--------|-------|
| 0 | Business prerequisites (DLT SMS, gateway, entity, domain) | ⏳ owner — **DLT is the longest pole** | blocks Step 5+ only |
| 1 | Monorepo scaffold | ✅ DONE (8aa726d) | typecheck 18/18 · build 11/11 · tests pass · /v1/health ok |
| — | K8s prep (D-016) | ✅ DONE (b4532c2) | Dockerfiles ×4, manifests, ingress/HPA design |
| — | Cluster setup + deploy | ✅ **DONE & VERIFIED (2026-11-05)** | namespace `apnacity`: postgres+postgis ✅ · redis ✅ · api ×2 health OK (`:30400/v1/health`) · web/seller/admin 200 (`:30280/81/82`) · PostGIS+pg_trgm enabled · images in local registry; **MinIO deferred** (Docker Hub rate-limit; needed at Step 5). Full state + gotchas: `infrastructure/CLUSTER.md` |
| 2 | Database foundation (geography+identity tables, extensions, RLS, seed) | ▶️ **NEXT** | run migrations from Mac via `DATABASE_URL=…30432` (command in CLUSTER.md) |
| 3 | CI pipeline wiring (GHCR? or local registry + actions) | pending | |
| 4 | Auth + RBAC + tenancy (M27 M26 M30 M29 M01 M02) | pending | |
| 5–18 | Seller/shop → … → pilot | pending | see guide PART III |

Module-level cards for every step: `docs/spec/12-module-build-cards.md`
(safe order: M27→M26→M30→M29→M01→M02→M03→M10→M04→M05→M06→M07→M08→M09→M11→M12→M15→M14→M13→M20→M17→M18→M19→M22→M23→M24→M16→M31→M25→M28→M32).

## 4. Key decisions (full log: docs/spec/00-README.md)

D-001 modular monolith · D-002 master product + seller listings · D-003 parent/child
orders · D-004 multi-shop cart (assumed) · D-005 both delivery modes (assumed) ·
D-006 any shopkeeper after KYC (assumed) · D-007 pilot Bijnor (assumed) · D-008
India entity (assumed) · D-009 `shop.apnacity.com` single-level wildcard (assumed) ·
D-010 Postgres FTS first, OpenSearch later · D-011 Expo · D-012 Cashfree ·
D-013 double-entry ledger · D-014 atomic inventory · D-015 microservice-extractable
modules · **D-016 Kubernetes deploy; dev = homelab cluster, LAN-only, NO tunnel
initially (owner decision 2026-11-05)**.

## 5. Conventions & hard rules (must follow)

1. Money = integer paise; UTC timestamps; UUID ids; snapshot order items.
2. Tenant (shop) isolation: `shop_id` + RLS + TenantGuard + CI isolation suite.
3. Cross-module access ONLY via ports (sync) / outbox events (async) — D-015.
4. Status changes: validated state machine + event row + outbox, one transaction.
5. Every PR: tests green + spec updated in the same PR (schema → guide PART II,
   endpoints → PART II module section). Definition of Done: guide PART III.
6. Never commit secrets; dev cluster creds live in `~/work/homelab/cred.MD`
   (reference only, never values in repo/chat).
7. Cluster day-2 ops: use `infrastructure/CLUSTER.md` commands; never touch the
   `astrology` / `simlab` / `xlienlabs` namespaces.
8. SAP VPN OFF for any 192.168.2.x access from the Mac.

## 6. Environment / access cheat-sheet

| Thing | Where |
|---|---|
| Repo clone | `~/work/hyperecom` (work here) |
| Old planning folder | `~/work/cline/apnacity-hyperlocal-ecom` (retired; holds GitHub token in `gitrepo/info.md` — **rotate**) |
| Homelab info/creds | `~/work/homelab/` (INSTRUCTIONS.md, cred.MD, kubeconfig/) |
| Dev URLs (LAN) | web `:30280` · seller `:30281` · admin `:30282` · api `:30400/v1/health` · postgres `:30432` · minio `:30900/:30901` — all on `192.168.2.224` |
| Deploy script | `infrastructure/kubernetes/scripts/deploy-dev.sh` |
| Verify pipeline | `pnpm lint && pnpm typecheck && pnpm test && pnpm build` |

## 7. Open risks / TODO (non-code)

- [ ] DLT SMS sender + template registration (blocks OTP at Step 4 go-live)
- [ ] Cashfree sandbox account
- [ ] Rotate GitHub PAT (ghp_…) and weak homelab passwords before any exposure
- [ ] Automate nightly `pg_dump` of cluster postgres (CronJob — add with Step 2)
- [ ] Confirm/override decisions D-004…D-009 before Step 5
- [ ] Docker Desktop on the Mac still not installed (optional — cluster DB is the primary dev DB now)

## 8. How to continue (for any model/agent)

1. Read §1 docs. 2. Check §3 tracker for the next step. 3. Implement exactly the
   step's module sections from `docs/COMPLETE-BUILD-GUIDE.md` PART II. 4. Verify
   the step's gate. 5. Update §3 tracker + `docs/START-HERE.md` §1 + commit/push.
   For infra changes: also update `infrastructure/CLUSTER.md`.
