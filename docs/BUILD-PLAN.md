# ApnaCity — Master Build Plan

> **🚀 WHERE TO START:** [`START-HERE.md`](START-HERE.md) — current
> project state + your exact next action. Development begins at
> `COMPLETE-BUILD-GUIDE.md` PART III **Step 0** (prerequisites) and **Step 1**
> (scaffold the monorepo).
>
> **👉 THE COMPLETE, SHAREABLE SPEC: `COMPLETE-BUILD-GUIDE.md`** — one
> self-contained document: all 32 modules (purpose · workflow · SQL tables ·
> APIs · rules · events · screens · acceptance tests), end-to-end workflows,
> master build sequence (Steps 0–18), frontend screens, testing, deployment,
> operations and India compliance. Organized module-by-module so you can request
> "Build M09" in any future session.
>
> This file is the short overview/entry point. Detail lives in
> `COMPLETE-BUILD-GUIDE.md` and `spec/00`–`12`.
>
> Status: **v1.0 — approved for implementation**
> Supersedes the roadmaps inside `concept.MD` and `implimentation.MD`.

---

## 1. What we are building

A **hyperlocal multi-vendor marketplace** where:

1. Customers shop on `apnacity.com` filtered by **state → city → locality**.
2. Every shopkeeper gets an **automatic storefront website** (`bagga-cloth.apnacity.com`).
3. A product is uploaded **once** by a shopkeeper and automatically appears on:
   - the shop's own website,
   - the central marketplace,
   - the city search results,
   - the customer mobile apps.
4. Customers **compare prices across local shops** (same product, different sellers)
   sorted by price / distance / rating / delivery speed.
5. Orders, delivery (own riders + seller self-delivery), returns, payments,
   commission and **double-entry settlement** run on one shared backend.

Six user experiences, one backend:

| # | Experience | Surface |
|---|-----------|---------|
| 1 | Customer marketplace | Next.js web + iOS/Android |
| 2 | Shop storefront (per tenant) | Next.js web (host-resolved) |
| 3 | Seller portal | Next.js PWA + iOS/Android |
| 4 | Admin portal | Next.js web |
| 5 | Delivery rider app | iOS/Android |
| 6 | Customer support / ops console | Admin portal module |

---

## 2. Locked decisions

| ID | Decision | Choice |
|----|----------|--------|
| D-001 | Architecture | Multi-tenant **modular monolith** (NestJS), one Postgres DB, module seams = future service boundaries |
| D-002 | Catalogue | Master `products` + `product_variants` shared; `seller_listings` carry price/MRP/SKU/tax/stock per shop |
| D-003 | Orders | Parent `orders` → `seller_orders` → `order_items` (immutable price/tax/name snapshot) |
| D-004 | Cart | One cart, one payment, split into per-shop child orders (assumed — confirm) |
| D-005 | Delivery | ApnaCity riders **and** seller self-delivery; 3PL adapters (Shadowfax/Shiprocket) later (assumed — confirm) |
| D-006 | Sellers | Any local shopkeeper after KYC verification (assumed — confirm) |
| D-007 | Pilot | Bijnor, Uttar Pradesh — general retail (assumed — confirm) |
| D-008 | Entity | India company, India operations (assumed — confirm) |
| D-009 | Domains | **`shop.apnacity.com`** single-level (one wildcard cert). See `spec/02` §3 — must confirm before Phase 1 |
| D-010 | Search | Postgres FTS + `pg_trgm` now; OpenSearch later behind `SearchPort` |
| D-011 | Mobile | React Native + Expo + EAS |
| D-012 | Payments | Cashfree Easy Split primary, Razorpay fallback, behind `PaymentProviderPort` |
| D-013 | Finance | Double-entry immutable ledger |
| D-014 | Inventory | Atomic conditional updates + TTL reservations; Redis is cache only |
| D-015 | Module packaging | Self-contained modules, ports+events only, microservice-extractable (`02` §10, `12`) |

---

## 3. Technology stack (final)

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Web (marketplace / city / shop storefront) | Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui |
| Seller portal | Next.js PWA (installable, camera capture) |
| Admin portal | Next.js (separate auth realm) |
| Mobile | React Native + Expo + EAS (customer / seller / rider) |
| Backend | NestJS modular monolith, REST, Swagger code-first |
| Database | PostgreSQL 16 + PostGIS, Prisma ORM |
| Cache & jobs | Redis 7 + BullMQ |
| Search | Postgres FTS + pg_trgm → OpenSearch (Phase 4) |
| Media | S3-compatible (MinIO dev / S3-R2 prod), sharp, Cloudflare CDN |
| Auth | OTP (DLT SMS) + password; JWT access 15 min + rotating refresh |
| Push | FCM + APNs |
| SMS / WhatsApp / Email | DLT-compliant SMS, WhatsApp Cloud API, SES/Resend |
| Payments | Cashfree / Razorpay behind provider port |
| Maps | Google Maps or Mapbox + PostGIS distance |
| Validation | Zod schemas in `packages/validation` |
| Observability | OpenTelemetry → Grafana stack, Sentry |
| CI/CD | GitHub Actions (lint → unit → integration → e2e → build → deploy) |
| Infra | Docker Compose (dev); Vercel/Render split or ECS (prod); Terraform from Phase 5 |

---

## 4. Repository structure

```
apnacity/
├── apps/
│   ├── web/                 # marketplace + city + shop storefront (host-resolved)
│   ├── seller-portal/       # PWA
│   ├── admin-portal/
│   ├── api/                 # NestJS modular monolith
│   └── mobile/              # expo: customer | seller | rider targets
├── packages/
│   ├── ui/                  # shared design system
│   ├── shared-types/        # TS types generated from OpenAPI
│   ├── api-client/          # generated fetch client (one contract, six UIs)
│   ├── validation/          # Zod schemas shared FE/BE
│   ├── db/                  # Prisma schema, client, migrations, seed
│   ├── events/              # outbox event names + payload types
│   └── config/              # env schema (Zod), tailwind, eslint, tsconfig
├── infrastructure/
│   ├── docker/              # compose services: pg+postgis, redis, minio, mail
│   ├── monitoring/          # otel collector, grafana dashboards
│   └── terraform/           # Phase 5+
├── spec/               # 00–09 (this spec set)
├── scripts/
├── tests/                   # integration + e2e
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml
└── .env.example
```

---

## 5. Module catalogue (summary)

### 5.1 Backend modules (NestJS — 32)

Each module owns: controller, service, DTOs, repository, authorization policies,
published events, unit + integration tests. **Cross-module access only via events
(transactional outbox) or published interfaces — never another module's tables.**

| # | Module | Responsibility |
|---|--------|----------------|
| 1 | `auth` | OTP request/verify, password login, JWT issue/refresh/revoke, device sessions |
| 2 | `users` | Profiles, addresses, RBAC users/roles/permissions |
| 3 | `geography` | countries/states/cities/localities/pincodes, serviceability, geo polygons |
| 4 | `sellers` | Seller onboarding, KYC documents, bank/payout profiles |
| 5 | `shops` | Shop aggregate, branding, settings, opening hours, tenant config |
| 6 | `shop-domains` | Slug allocation, hostname→tenant resolution, TLS strategy |
| 7 | `catalog` | Categories, brands, attribute schemas, master products, variants |
| 8 | `listings` | Seller listings, listing variants, price/MRP/SKU/tax, listing lifecycle |
| 9 | `inventory` | Stock, reservations, movements, low/out-of-stock alerts |
| 10 | `media` | Signed uploads, image processing/derivatives, CDN invalidation |
| 11 | `search` | `SearchPort` (Postgres impl → OpenSearch impl), indexing, synonyms |
| 12 | `cart` | Carts, cart items, multi-shop grouping, price revalidation |
| 13 | `checkout` | Address/serviceability, delivery fee, coupon apply, payment intent |
| 14 | `orders` | Parent/child orders, state machine, events, cancellation, snapshots |
| 15 | `payments` | `PaymentProviderPort`, webhooks, idempotency, refunds |
| 16 | `finance` | Double-entry ledger, commission, settlements, payout batches |
| 17 | `delivery` | Zones, fee/ETA, rider assignment, shipments, tracking, OTP/PoD |
| 18 | `delivery-partners` | Rider registration, KYC, availability, earnings |
| 19 | `returns` | Return/exchange requests, inspections, refund triggers |
| 20 | `promotions` | Coupons, campaigns, discounts, sponsored placements |
| 21 | `reviews` | Product/shop reviews, ratings, moderation |
| 22 | `notifications` | Template registry (DLT), channels (SMS/WhatsApp/push/email), prefs, queue |
| 23 | `support` | Tickets, disputes, escalation, resolution workflow |
| 24 | `admin` | Admin ops console APIs: approvals, config, feature flags |
| 25 | `analytics` | Events ingestion, seller/city/platform dashboards, reports |
| 26 | `audit` | Immutable audit log for seller/admin/security actions |
| 27 | `outbox` | Transactional outbox, event dispatch, retry/DLQ |
| 28 | `webhooks` | Inbound (payments) + outbound (seller integrations) webhook management |
| 29 | `feature-flags` | Kill switches and gradual rollouts |
| 30 | `idempotency` | Idempotency-key store for payments/orders/imports |
| 31 | `invoicing` | GST invoices, e-invoice hooks, credit notes |
| 32 | `content` | City landing pages, banners, FAQ/help centre (CMS) |

### 5.2 Frontend modules

| App | Modules |
|-----|---------|
| `web` (customer) | geo-select, home, category, search+filters, PDP with price comparison, cart, checkout, orders+live tracking, wishlist, reviews, account, addresses, auth, city landing, **shop storefront (tenant)**, per-tenant SEO/sitemap/robots |
| `seller-portal` | dashboard, onboarding+KYC, shop profile, **5-step product wizard**, bulk CSV import, inventory, orders, delivery config, payments/commission, offers, reviews, reports, settings |
| `admin-portal` | geography/taxonomy, seller approval, shops, orders/disputes, commissions, settlements, CMS, promos, feature flags, audit, analytics, support queue |
| mobile-customer | browse/search, PDP, cart/checkout, order tracking, wishlist, OTP auth, push, deep links |
| mobile-seller | camera upload, quick stock edit, order accept/reject, earnings |
| mobile-rider | availability toggle, job queue, navigation, OTP/PoD, offline queue, earnings |

Full per-module detail (APIs, entities, events, test list) → `spec/05`.
**Independently buildable work orders per module → `spec/12` (say "Build M09" in any future session).**
Module isolation & microservice extraction strategy → `spec/02` §10 (D-015).

---

## 6. Critical design rules (non-negotiable)

1. Product master data is independent of seller listings; never duplicate a master
   product because a second shop sells it.
2. Every seller-scoped row carries `shop_id`; every tenant API enforces isolation
   (service-level guard + Postgres RLS as second line of defense).
3. Order rows snapshot product name, SKU, price, tax at purchase time — orders never
   depend on live listing rows to render history.
4. Financial entries are immutable; append-only, referenced by settlement batches.
5. Inventory reservation is atomic (`UPDATE … WHERE available >= n`) with TTL;
   Redis is never the authority for stock.
6. Order status changes go through a validated state machine with role×transition
   checks and an immutable `order_events` history (`spec/06`).
7. All external writes accept idempotency keys; payment webhooks verify signatures
   and reject replays.
8. UUID primary keys internally; human-readable order numbers (`APN-2026-000123`) externally.
9. All timestamps UTC; display in local timezone.
10. No fake APIs, no placeholder buttons, no hardcoded business data — ever.

---

## 7. Phases and sprints (2-week sprints)

Assumed team: 1 tech lead, 2 full-stack, 1 mobile, 1 QA, part-time designer.

| Phase | Weeks | Scope | Key acceptance criteria |
|-------|-------|-------|------------------------|
| **P0 Foundations** | 2 | monorepo, CI, Docker, Prisma+PostGIS, auth (OTP+JWT), RBAC, tenancy middleware, geography seed, audit, outbox skeleton, Swagger + generated client | `/health` green; host→tenant resolution works; tenant-isolation test suite passes |
| **P1 Seller & shop** | 5 | seller onboarding+KYC, shop creation, slug/domain, media pipeline, seller portal shell, 5-step product wizard, bulk import | New shopkeeper publishes 10 products in < 15 min (measured) |
| **P2 Catalogue & storefront** | 5 | categories/attributes/variants, listings, inventory engine, shop storefront pages, marketplace home/browse, PDP with price comparison | 100-concurrent-order no-oversell test passes |
| **P3 Search, cart, checkout, payments** | 4 | FTS+trigram search, filters/sorts, cart, multi-shop checkout, Cashfree test mode, webhooks, idempotency | Test payment → child orders created; replayed webhook ignored |
| **P4 OMS, delivery, notifications** | 6 | full order state machine, seller accept/reject, rider assignment, seller self-delivery, OTP/PoD, returns, DLT SMS + push + WhatsApp | End-to-end Bijnor order incl. return works on staging |
| **P5 Finance & admin** | 5 | double-entry ledger, commission config, settlements, refunds, GST invoices, admin portal, disputes | Ledger reconciles to gateway report to the paisa |
| **P6 Mobile apps** | 6 | customer/seller/rider Expo apps, push, deep links, offline rider queue | All three on TestFlight + internal testing track |
| **P7 Hardening & pilot** | 4 | OpenSearch swap, load test, security review, backups/DR, SLOs, SEO, CMS, feature flags, Bijnor launch (20–50 shops) | p95 search < 300 ms; RPO 15 min / RTO 1 h; pilot checklist signed |

**Total ≈ 37 weeks (~9 months)** to hardened single-city pilot.
**Marketplace MVP (P0–P3) ≈ 16 weeks.**

Sprint-level breakdown → `spec/07`.

## 8. Definition of Done (every phase)

- [ ] Unit + integration + tenant-isolation tests green in CI
- [ ] Swagger updated; `packages/api-client` regenerated
- [ ] Schema changes applied to `spec/03` in the same PR
- [ ] No fake APIs / non-functional buttons / placeholder payment flows
- [ ] Audit events emitted for every state-changing privileged action
- [ ] Runbook + ADR updated; phase demo delivered

---

## 9. Spec index

| Doc | Path |
|-----|------|
| 00 README & decision log | `spec/00-README.md` |
| 01 Vision & business | `spec/01-vision-and-business.md` |
| 02 Architecture | `spec/02-architecture.md` |
| 03 Data model | `spec/03-data-model.md` |
| 04 API contract | `spec/04-api-contract.md` |
| 05 Module catalogue | `spec/05-module-catalogue.md` |
| 06 State machines | `spec/06-state-machines.md` |
| 07 Roadmap & sprints | `spec/07-roadmap-and-sprints.md` |
| 08 Security & compliance | `spec/08-security-compliance.md` |
| 09 NFR & ops | `spec/09-nfr-and-ops.md` |
| 10 Build sequence (Steps 0–18) | `spec/10-build-sequence.md` |
| 11 Appendix (sequences, ledger example, templates, CI, env, coverage) | `spec/11-appendix.md` |
| 12 Module build cards (M1–M32, independently buildable) | `spec/12-module-build-cards.md` |

## 10. Immediate next actions

1. Confirm/override decisions **D-004 … D-009** (cart, delivery, sellers, pilot, entity, domain scheme).
2. Choose payment provider (Cashfree vs Razorpay) and complete merchant onboarding.
3. Buy/verify DNS + decide TLS strategy (see `02` §3) before Phase 1 shop-domain work.
4. Set up DLT sender ID + SMS template registration (lead time: days–weeks) — start now.
5. Scaffold monorepo (P0) and merge the Phase 0 Definition of Done.


