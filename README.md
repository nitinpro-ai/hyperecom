# ApnaCity (hyperecom) — Hyperlocal Multi-Vendor E-Commerce Marketplace

> City-first marketplace for local shops: customers select **state → city**,
> compare **real prices from real local shops**, and order with local delivery.
> Every shopkeeper gets an automatic website (`bagga-cloth.apnacity.com`) — a
> product uploaded once appears on the shop site, the marketplace, city search
> and the mobile apps.

**Status:** 📋 Planning complete · 💻 **Step 1 + dev cluster DONE — Step 2 (database) next** ·
**👉 [docs/START-HERE.md](docs/START-HERE.md)** (entry point) ·
**[docs/TRACKING.md](docs/TRACKING.md)** (progress tracker) ·
**[infrastructure/CLUSTER.md](infrastructure/CLUSTER.md)** (dev cluster on Kubernetes).

## Repository layout

```
hyperecom/
├── docs/                     # ← start here
│   ├── START-HERE.md         # 🚀 development entry point (current state + next action)
│   ├── COMPLETE-BUILD-GUIDE.md  # 📕 THE master spec: all 32 modules (SQL, APIs, rules,
│   │                            #    tests), workflows, build sequence Steps 0–18, ops
│   ├── BUILD-PLAN.md         # short overview: stack, decisions, phases
│   ├── spec/                 # 00–12 detailed reference (data model, state machines, …)
│   ├── adr/                  # architecture decision records
│   └── legacy/               # original concept notes (superseded — historical only)
├── apps/                     # (created in build Step 1)
│   ├── web/                  # marketplace + city + shop storefronts (Next.js)
│   ├── seller-portal/        # seller PWA (Next.js)
│   ├── admin-portal/         # admin console (Next.js)
│   ├── api/                  # NestJS modular monolith (32 modules)
│   └── mobile/               # Expo: customer / seller / rider apps
├── packages/                 # ui · shared-types · api-client · validation · db · events · config
├── infrastructure/           # docker · monitoring · terraform
├── scripts/ · tests/
└── .env.example
```

## Tech stack

Next.js 15 · NestJS · PostgreSQL 16 + PostGIS · Prisma · Redis + BullMQ ·
React Native + Expo · S3 + Cloudflare · Cashfree · Docker · GitHub Actions.

## How development proceeds

1. Read [`docs/START-HERE.md`](docs/START-HERE.md) (5 min).
2. Follow the build sequence: **Steps 0–18** in
   [`docs/COMPLETE-BUILD-GUIDE.md`](docs/COMPLETE-BUILD-GUIDE.md) PART III —
   each step has modules, tasks and a **verify gate**.
3. Modules M01–M32 are fully specified in PART II of the guide — any module can
   be requested standalone ("Build M09") and is microservice-extractable.

## Documentation index

| Want to… | Open |
|----------|------|
| Start development | [`docs/START-HERE.md`](docs/START-HERE.md) |
| Read the full spec | [`docs/COMPLETE-BUILD-GUIDE.md`](docs/COMPLETE-BUILD-GUIDE.md) |
| See the short plan | [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md) |
| Deep reference | [`docs/README.md`](docs/README.md) → `docs/spec/00–12` |
