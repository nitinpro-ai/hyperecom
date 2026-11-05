# 🚀 START HERE — ApnaCity Development Entry Point

> **You asked: "where do I start the development?" — this file is the answer.**
> Read only this file first. It tells you exactly what to do today, this week,
> and in what order to build everything else.
>
> Last updated: 2026-11-05 (post-repo-setup) · Status: **planning complete, repo live, code not started**

---

## 1. Where you are right now (project state / memory)

| Item | Status |
|------|--------|
| Business concept | ✅ done (`legacy/concept.MD` — superseded input) |
| Complete build specification | ✅ done (`COMPLETE-BUILD-GUIDE.md` — **the master document**) |
| Detailed reference specs | ✅ done (`spec/00–12` in this folder) |
| **Git repository** | ✅ live → **https://github.com/nitinpro-ai/hyperecom** (branch `main`) |
| **Development clone (USE THIS)** | ✅ `/Users/D073341/work/hyperecom` — all future work happens here |
| Old planning folder | `/Users/D073341/work/cline/apnacity-hyperlocal-ecom` — retired; holds local-only `gitrepo/info.md` (token) |
| Business decisions | ⚠️ 6 defaults assumed — need confirmation (§4 below) |
| External registrations (DLT, gateway, entity) | ❌ not started — **longest lead time, start today** |
| GitHub token rotation | ⚠️ **PENDING** — token `ghp_ZlpU…` was shared in plaintext; revoke + create new (SSH recommended) |
| Local toolchain | ✅ Node 26 · ✅ pnpm 12.16.1 (installed via `npm i -g pnpm`) · ❌ **Docker Desktop NOT installed** (needed for `docker compose up -d` in Step 2 — install from docker.com) |
| **Code — Step 1 scaffold** | ✅ **DONE** — monorepo builds green: typecheck 18/18, build 11/11, tests pass, `GET /v1/health` returns ok (NestJS API + 3 Next.js apps + 7 packages + docker-compose + CI workflow + DEVELOPMENT.md) |
| **Deployment target (D-016)** | ✅ **Kubernetes** — production Dockerfiles for all 4 apps (`apps/*/Dockerfile`, standalone Next output) + manifests in `infrastructure/kubernetes/` (namespace, api/web deployments+HPA, ingress with cert-manager wildcard TLS) |
| **Build/test server** | ⏳ **WAITING ON OWNER** — when shared, provide: ① kubeconfig/SSH + cluster type (k3s? managed?) ② registry choice (GHCR?) ③ Postgres/Redis in-cluster vs managed (PostGIS required) ④ ingress+cert-manager installed? ⑤ server CPU/RAM. Open items tracked in `infrastructure/kubernetes/README.md` |
| **Code — next step** | ▶️ **Step 2 — Database foundation**: geography + identity/tenancy tables, postgis/pg_trgm/ltree extensions, RLS policies, India geo seed (guide PART II M03 tables + spec/03 §2–3) |

> **How "memory" works:** chat history is not carried between sessions. This
> file is the handoff — keep it updated as work progresses (mark steps done,
> note decisions, record commit IDs) and any future session picks up exactly
> where you left off. **Rule: every session ends by updating this section + committing.**

## 2. The one document you need

**`COMPLETE-BUILD-GUIDE.md`** — everything is in there, organized per module:
- PART I — the 10 end-to-end workflows
- PART II — all 32 modules (M01–M32): SQL tables, APIs, rules, tests
- PART III — **master build sequence Steps 0–18 (your roadmap)**
- PART IV — every screen for every app
- PART V — testing, deployment, compliance

`BUILD-PLAN.md` = short overview. `spec/00–12` = deep reference.
You never need to read the spec folder to start — the guide is self-contained.

## 3. EXACTLY where to start (do in this order)

### TODAY — no code, just unblock (Guide: PART III, Step 0)
1. Confirm the 6 decisions in §4 below (5-minute reply to your AI agent).
2. Start external registrations — these have days/weeks of lead time:
   - **DLT SMS sender ID + templates** (blocks OTP login — longest pole)
   - Cashfree/Razorpay merchant onboarding (sandbox keys)
   - India entity + GST (if not already done)
   - Domain `apnacity.com` + Cloudflare + wildcard `*.apnacity.com`

### FIRST CODING DAY — Guide: PART III, Step 1 (scaffold)
Give your AI coding agent this prompt:

> "Read COMPLETE-BUILD-GUIDE.md PART III Step 1 and Step 2. Scaffold the
> monorepo exactly as specified (pnpm + Turborepo, apps: web, seller-portal,
> admin-portal, api; packages: ui, shared-types, api-client, validation, db,
> events, config; docker-compose with postgis/redis/minio/mailpit) and set up
> the first Prisma migration for the geography tables. Then verify the Step 1
> and Step 2 gates."

### THEN — follow the sequence, one step at a time
```
Step 0  prerequisites (business)          ← TODAY (DLT/gateway/entity — parallel, blocks Step 5+)
Step 1  scaffold monorepo                 ← ✅ DONE (typecheck/build/tests/health all green)
Step 2  database + geography seed         ← ▶️ NEXT (needs Docker Desktop installed first)
Step 3  CI pipeline
Step 4  auth + RBAC + tenancy  (modules M27 M26 M30 M29 M01 M02)
Step 5  seller onboarding + shop + domains (M04 M05 M06)
Step 6  media pipeline                    (M10)
Step 7  product wizard + listings + import (M07 M08)   ← sellers can publish
Step 8  inventory engine                  (M09)
Step 9  storefront + marketplace + PDP
Step 10 search                            (M11)
Step 11 cart + checkout + payments        (M12 M13 M15 M20) ← MVP purchase works
Step 12 OMS + timers                      (M14)
Step 13 delivery + riders                 (M17 M18)
Step 14 notifications + returns + support (M22 M19 M23)
Step 15 ledger + settlements + invoicing  (M16 M31)
Step 16 admin + analytics                 (M24 M25)
Step 17 mobile apps (customer/seller/rider)
Step 18 hardening + Bijnor pilot launch
```
Every step has a **Verify gate** in the guide — a step is done only when its
gate passes. Each step = one or more PRs.

**Rule of thumb:** at any point, your next action is always
"Guide PART III → next incomplete Step → give that Step (+ its module sections
from PART II) to your AI agent."

## 4. Decisions you must confirm before Step 5 (reply in one line each)

| ID | Question | Default (assumed) | Your answer |
|----|----------|-------------------|-------------|
| D-004 | Multi-shop cart (one checkout, split orders)? | Yes | ___ |
| D-005 | Delivery: platform riders AND seller self-delivery? | Both | ___ |
| D-006 | Who can sell: any shopkeeper after KYC? | Yes | ___ |
| D-007 | Pilot city & scope: Bijnor, all general retail? | Yes | ___ |
| D-008 | Legal entity: India company? | Yes | ___ |
| D-009 | Domains: `shop.apnacity.com` (single wildcard cert)? | Yes (recommended) | ___ |

Payment provider choice (Cashfree vs Razorpay) is also open — default Cashfree.

## 5. Milestones to expect

| When | What works |
|------|-----------|
| Week 2 | Foundations: auth, tenancy, CI green |
| Week 8 | **A shopkeeper can publish products** (the core promise) |
| Week 14 | Storefronts + marketplace visible, price comparison live |
| Week 18 | **MVP: full purchase flow** (test-mode payments) |
| Week 24 | Delivery + returns operational |
| Week 30 | Money end-to-end: commission, settlements, invoices |
| Week 36 | All 3 mobile apps |
| Week 40 | **Bijnor pilot launch (20–50 shops)** |

## 6. As you progress — keep this file updated

After each step, edit §1 and §3: mark the step ✅ done and note the PR/commit.
This file is the single handoff point between you, your team, and any AI agent.
