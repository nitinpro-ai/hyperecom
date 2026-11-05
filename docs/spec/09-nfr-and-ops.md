# 09 — NFR, Environments & Operations

## 1. Performance targets (pilot scale)

| Metric | Target |
|--------|--------|
| Search p95 | < 300 ms |
| PDP SSR p95 | < 500 ms (TTFB), LCP < 2.5 s on 4G |
| Place-order API p95 | < 800 ms |
| Seller order-notify latency (order → push/SMS) | < 5 s p95 |
| Rider assignment (ready → offer) | < 10 s |
| Concurrent users (pilot) | 2,000 |
| Catalogue size (pilot) | 50k listings, 20k master products |
| Image derivative generation | < 10 s p95 |
| DB connection pool | app 20 + jobs 10 per instance |

Load-tested at Phase 7 (200 rps browse, 50 rps search, 20 orders/min for 30 min)
with k6; results recorded in ADR.

## 2. Scalability posture

- Stateless API (JWT) → horizontal scale behind LB; Redis for sessions/cache.
- Read scaling: PgBouncer; read-replica for analytics/search-heavy queries.
- BullMQ workers separately deployable from API (same codebase, worker entrypoint).
- ISR + CDN for all storefront/product pages (origin shield).
- Partitioning plan: `order_events`, `analytics_events`, `tracking_events`
  monthly partitions from day 1 (03 §13).

## 3. Observability

- **Tracing:** OpenTelemetry auto-instrumentation (HTTP, Prisma, BullMQ, Redis);
  traceId in every log line and error envelope.
- **Metrics (Grafana):** RED per endpoint; queue depth/latency/DLQ; outbox lag;
  ledger imbalance check; business metrics (orders/hour, accept rate, delivery
  ETA actual vs quoted).
- **Logs:** structured JSON (pino), 30-day hot / 1-year cold.
- **Alerting (PagerDuty-style):** 5xx > 1% 5 min; outbox DLQ > 0; ledger imbalance;
  payment webhook failure spike; reservation leak detection (ACTIVE reservations
  with no live order); disk > 80%; cert expiry < 14 days.
- **Sentry** for web + mobile (release-tagged, source maps).

## 4. Environments & release

| Env | Deploy trigger | Data | Notes |
|-----|---------------|------|-------|
| local | — | seed | docker compose |
| staging | push `main` | anonymised prod snapshot (weekly) | full e2e |
| production | tag `v*` + manual approve | real | blue/green; migration gate |

- Migrations run as a deploy pre-step with `migrate deploy`; destructive changes
  require two-step (add → backfill → switch → drop later).
- Rollback: previous image tag; DB roll-forward only (migrations always
  forward-compatible for one release).
- Mobile: EAS build + submit; staged rollout 10% → 50% → 100% with crash gate.

## 5. Backup & DR

- Postgres: managed PITR (RPO 15 min) + nightly logical dump to separate region (30-day retention).
- Object storage: versioning + cross-region replication for KYC/media.
- Redis: AOF; cache is rebuildable (no durable authority).
- DR drill quarterly: restore to scratch env, run smoke suite, record time-to-restore.

## 6. Pilot launch checklist (Bijnor)

- [ ] DLT + WhatsApp templates approved & live in production
- [ ] Payment gateway KYB complete; live keys; split-settlement configured
- [ ] Wildcard DNS + TLS verified from 3 networks
- [ ] 20–50 shops onboarded; ≥ 20 products each; photos quality-checked
- [ ] Rider pool ≥ 5 approved riders; seller self-delivery enabled as default
- [ ] Support rota + grievance officer published (Consumer Rules)
- [ ] GST/TCS config signed off by CA; first settlement dry-run verified
- [ ] Load + pen test sign-offs
- [ ] Feature flags: COD limited, AI features off, sponsored off
- [ ] Dashboards: city ops, seller health, SLO alerts live
- [ ] Rollback + incident runbook rehearsed

## 7. Runbooks (to be maintained in `docs/runbooks/`)

`incident-api-5xx` · `incident-payment-webhook-failures` · `incident-oversell-report`
· `job-outbox-dlq` · `job-settlement-run` · `ops-shop-onboarding` ·
`ops-refund-manual` · `ops-tenant-migration` (slug change) · `dr-restore`.

## 8. Cost envelope (pilot month, indicative)

| Item | Est. monthly |
|------|--------------|
| Compute (API + web + workers) | ₹25–45k |
| Postgres (managed, 2 vCPU) + replica | ₹15–25k |
| Redis, object storage, CDN | ₹8–15k |
| SMS (DLT) + WhatsApp + push | usage-based |
| Payment gateway | % of GMV |
| Maps API | ₹5–10k (capped by caching geocodes) |
| Monitoring | ₹5–10k |

> Optimisation: aggressive caching of geocodes/tenant resolution; SMS only for
> critical events (push-first policy) keeps notification costs < ₹3/order.
