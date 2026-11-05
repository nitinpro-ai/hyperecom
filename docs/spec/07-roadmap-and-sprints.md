# 07 — Roadmap, Sprints & Delivery

## 1. Team & cadence

| Role | Count | Notes |
|------|-------|-------|
| Tech lead / architect | 1 | reviews, tenancy, state machines |
| Full-stack engineers | 2 | NestJS + Next.js |
| Mobile engineer | 1 | Expo (joins Phase 6, helps web earlier) |
| QA engineer | 1 | automation + tenant-isolation suite |
| Designer (fractional) | 0.5 | seller-portal UX is the priority surface |

2-week sprints · planning Mondays · demo + retro alternate Fridays · 15 % buffer
per sprint · hotfix path outside cadence.

## 2. Phase → sprint breakdown

### Phase 0 — Foundations (S0–S1, 2 weeks)
- **S0:** monorepo scaffold (pnpm+turbo), Docker Compose (pg+postgis, redis,
  minio, mailpit), CI (lint/test/build), Prisma schema v0 + migrations, env
  validation, structured logging + trace IDs, health checks.
- **S1:** auth (OTP+password, JWT+refresh rotation), RBAC guards, `TenantGuard`
  skeleton, geography + seed, audit module, outbox skeleton, Swagger +
  `api-client` generation in CI.
- **Exit:** staging `/health` green; host→tenant resolution e2e; canary
  tenant-isolation suite passing; demo login as 3 roles.

### Phase 1 — Seller & shop (S2–S4, 5 weeks incl. spill)
- **S2:** sellers module (onboarding wizard APIs), KYC upload (media module,
  signed uploads, scan), admin approval queue.
- **S3:** shops + shop-domains (slug allocation, resolve API, Redis cache),
  seller-portal shell (dashboard, onboarding UX, hi/en i18n), branding settings.
- **S4:** product wizard backend (draft→publish validation), bulk CSV import
  (queue + row errors), orders inbox (read-only).
- **S5 (spill):** wizard polish, media derivatives, low-stock alerts.
- **Exit (measured):** new shopkeeper registers → KYC → shop created →
  **publishes 10 products in < 15 min unaided** (usability test with 3 real
  shopkeepers); slug collision race test passes.

### Phase 2 — Catalogue & storefront (S5–S7, 5 weeks)
- **S5:** catalog (categories + attribute_schema, brands, products, variants),
  admin taxonomy console, GTIN dedupe + merge queue.
- **S6:** inventory engine (atomic reserve/release, movements, TTL job) +
  concurrency harness; listings live on shop storefront (ISR + revalidate).
- **S7:** marketplace home/browse, city landing pages, PDP with cross-shop
  offers table (variant-aware), price/stock badges.
- **Exit:** 100-parallel-order no-oversell green; SEO checks (meta, per-tenant
  sitemap, JSON-LD) green; PDP shows offers from ≥ 3 seeded shops.

### Phase 3 — Search, cart, checkout, payments (S8–S9, 4 weeks)
- **S8:** search (Postgres FTS+trigram, filters, geo-distance sorts,
  suggestions, synonyms), analytics events wiring.
- **S9:** cart, checkout quote (zones/fees/ETA/coupons), payment intent
  (Cashfree **test** mode), transactional `POST /orders` + idempotency,
  webhook handling (signature+replay), confirmation pages.
- **Exit:** full test-mode purchase across 3 shops in one cart; replayed webhook
  ignored; stock drift surfaced per-item; p95 search < 300 ms on seed data.

### Phase 4 — OMS, delivery, notifications (S10–S12, 6 weeks)
- **S10:** full state machines + timers (accept deadline, reservation TTL,
  auto-reject/refund), seller flows, cancellations + scoped refunds.
- **S11:** delivery engine (jobs, assignment scoring, offer windows, OTP/PoD,
  tracking), seller self-delivery, delivery-partners module, failure →
  return-to-seller.
- **S12:** notifications (DLT SMS, FCM, WhatsApp, email; prefs, fallback),
  returns (windows, pickup, inspection), support tickets MVP.
- **Exit:** staging journey order → accept → rider → OTP → delivered → return →
  refund fully evented; DLT templates live in staging.

### Phase 5 — Finance & admin (S13–S15, 5 weeks)
- **S13:** ledger postings (capture, commission, fees, refunds, COD),
  commission config, reconciliation job.
- **S14:** settlements (T+2, statements PDF, provider split payout), invoicing
  (GST + credit notes), COD reconciliation.
- **S15:** admin portal completion (ops console, disputes, config, audit),
  analytics dashboards v1.
- **Exit:** ledger reconciles to gateway report to the paisa over a simulated
  week incl. refunds + COD; two-person payout rule enforced.

### Phase 6 — Mobile apps (S16–S18, 6 weeks)
- **S16:** Expo workspace + shared packages; customer app core (browse, PDP,
  cart, checkout with UPI intent), OTP auth, push.
- **S17:** customer tracking + deep links; seller app (wizard, orders, quick
  stock); rider app (jobs, OTP/PoD, offline queue).
- **S18:** polish, Hindi QA, TestFlight + Play internal, crash/analytics SDK.
- **Exit:** all 3 apps pass scripted journeys on real devices; airplane-mode
  rider sync test passes.

### Phase 7 — Hardening & pilot (S19–S20, 4 weeks)
- **S19:** OpenSearch swap behind SearchPort (only if load test justifies);
  load test (200 rps browse / 50 rps search / 20 orders/min × 30 min); pen-test
  fixes; backup/DR drill.
- **S20:** SEO/OG polish, CMS city pages, feature-flag rollout, shopkeeper
  onboarding kit (QR + video), **Bijnor pilot launch (20–50 shops)**, war-room rota.
- **Exit:** pilot checklist (09 §6) signed; SLO dashboards live; first real
  orders settling correctly.

## 3. Timeline summary

| Milestone | End of | Cumulative weeks |
|-----------|--------|------------------|
| Foundations done | S1 | 2 |
| Seller can publish | S4 | 8 |
| Storefront + marketplace visible | S7 | 14 |
| **MVP: full purchase flow (test mode)** | S9 | **18** |
| Delivery + returns operational | S12 | 24 |
| Money end-to-end (ledger/settlement) | S15 | 30 |
| Mobile apps | S18 | 36 |
| Pilot launch (Bijnor) | S20 | **40 (incl. buffer)** |

## 4. Risk register (top 10)

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | DLT/WhatsApp template approvals delay | High | Blocks OTP/order SMS | Start registrations Week 1; push+email fallback |
| R2 | Shopkeeper usability fails (<15 min goal) | Medium | Core value prop | Usability tests with real shopkeepers each phase; Hindi-first UX |
| R3 | Oversell under concurrency | Medium | Trust | Atomic SQL + dedicated concurrency suite from Phase 2 |
| R4 | GST/TCS settlement complexity | High | Legal/finance | CA/advisor engaged before Phase 5; config-driven rates |
| R5 | Payment split (Cashfree Easy Split) edge cases | Medium | Payouts | Exhaustive sandbox tests; reconciliation job from day 1 |
| R6 | Wildcard DNS/TLS misconfig | Low | Storefronts down | D-009 locked in Phase 0; staging wildcard verification |
| R7 | Scope creep (Amazon-feature envy) | High | Timeline | Phase gates + out-of-scope list (01 §5.2) |
| R8 | Rider supply in Bijnor | Medium | Delivery SLA | Recruit before Phase 7; seller self-delivery default |
| R9 | Duplicate catalogue chaos | Medium | Search quality | GTIN-first + merge queue + admin governance |
| R10 | Single-city pilot economics | Medium | Business | Pilot metrics (01 §8) reviewed at 30/60/90 days |

## 5. Change control

- Any change to decisions D-001…D-014 ⇒ update `00-README` decision log + affected
  spec sections + ADR in `docs/adr/NNN-*.md` (context / decision / consequences).
- Schema changes: migration PR reviewed by tech lead; never edit a merged migration.

## 6. Definition of Done (recurring)

- [ ] All module tests + tenant-isolation suite green
- [ ] Swagger + generated client updated
- [ ] Spec docs (03/04/05/06) updated in the same PR
- [ ] Audit events for privileged actions
- [ ] Feature flagged if risky
- [ ] Runbook entries for new jobs/endpoints
- [ ] Sprint demo delivered; retro actions logged

