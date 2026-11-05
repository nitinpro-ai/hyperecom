# 02 — System Architecture

## 1. Architecture style

**Multi-tenant modular monolith** — one NestJS deployable, one PostgreSQL database,
strict module boundaries. Not microservices: at pilot scale microservices add
network failure modes, distributed transactions and operational cost with no benefit.
Each NestJS module boundary is a *future* service seam; extract only when traffic
or team size justifies it (expected: search indexing and notification dispatch are
the first candidates).

```
                     ┌──────────────────────────────────────────────┐
   Presentation      │ web · seller-portal · admin-portal           │
                     │ mobile-customer · mobile-seller · mobile-rider│
                     └───────────────────┬──────────────────────────┘
                                         │ HTTPS / JSON / generated TS client
                     ┌───────────────────▼──────────────────────────┐
   Edge              │ CDN (Cloudflare) · WAF · rate limit           │
                     │ Host-based tenant resolution (middleware)     │
                     └───────────────────┬──────────────────────────┘
                                         │
                     ┌───────────────────▼──────────────────────────┐
   API (NestJS)      │ auth · geography · sellers · shops · domains │
                     │ catalog · listings · inventory · media       │
                     │ search · cart · checkout · orders · payments │
                     │ finance · delivery · returns · promotions    │
                     │ reviews · notifications · support · admin    │
                     │ analytics · audit · outbox · webhooks · …    │
                     └──────┬────────────┬────────────┬─────────────┘
                            │            │            │
              ┌─────────────▼──┐  ┌──────▼─────┐  ┌───▼──────────┐
   Data       │ PostgreSQL 16  │  │ Redis 7    │  │ S3 + CDN     │
              │ + PostGIS      │  │ cache/jobs │  │ media        │
              │ (source of     │  │ BullMQ     │  │              │
              │  truth, RLS)   │  │            │  │              │
              └────────────────┘  └────────────┘  └──────────────┘
                            │
              ┌─────────────▼──────────────────────────────────────┐
   External   │ Cashfree/Razorpay · DLT SMS · WhatsApp · FCM/APNs  │
              │ Maps · email · (later: Shadowfax/Shiprocket, ONDC) │
              └────────────────────────────────────────────────────┘
```

## 2. Multi-tenancy

### 2.1 Model
- **Shared database, shared schema, `tenant_id`/`shop_id` column isolation.**
  No per-shop deployments, no per-shop databases.
- Tenant = **shop** (the selling unit). City is a *geo dimension*, not a tenant.
- Every tenant-scoped table has `shop_id uuid NOT NULL REFERENCES shops(id)`.
- **Defense in depth:**
  1. Application: `TenantGuard` resolves tenant from host / token and injects
     `shop_id` into every query; repository layer accepts no query without it.
  2. Database: Postgres **Row-Level Security** enabled on all tenant tables;
     session `app.current_tenant` GUC set per request by the connection pool.
  3. Tests: a dedicated tenant-isolation suite attempts cross-tenant read/write
     on every tenant table and must fail (part of CI).

### 2.2 Host → tenant resolution flow

```
request: bagga-cloth.apnacity.com/product/nike-air-max
   │
   ▼
Next.js middleware (edge)
   ├─ parse host → slug = "bagga-cloth"
   ├─ GET tenant cache (Redis, 60s TTL)  ── miss ──► GET /internal/resolve-tenant
   ├─ no match  → redirect to apnacity.com (or 404 for unknown slugs)
   ├─ match     → inject x-tenant-id headers; rewrite to /shop/[slug]/…
   └─ apex/www  → marketplace routes (city from cookie/GPS/pincode)
   │
   ▼
NestJS TenantGuard (on API calls)
   └─ validates x-tenant-id signature (HMAC) set at edge, or resolves from JWT claim
```

- Resolution cache is Redis with 60s TTL + explicit invalidation on shop update.
- Slug allocation is transactional with a unique constraint; collision → suffix rule
  (`bagga-cloth-2`), seller may request custom slug later (admin approval).
- All storefront pages are server-rendered (SSR/ISR) for SEO; product pages ISR
  with revalidate-on-publish webhook.

## 3. Domain & TLS strategy (D-009 — decide before Phase 1)

| Option | Example | TLS reality | Verdict |
|--------|---------|-------------|---------|
| **A. Single-level shop subdomain** | `bagga-cloth.apnacity.com` | One wildcard `*.apnacity.com` covers everything | ✅ **Recommended** — simplest, cheapest, zero per-city automation |
| B. Shop under city | `bagga-cloth.bijnor.apnacity.com` | Needs `*.bijnor.apnacity.com` per city (ACME DNS-01 automation) or Cloudflare custom hostnames; `*.*.apnacity.com` is **not** a valid cert | Viable later; ops burden grows with every city |
| C. Path-based | `apnacity.com/shops/bagga-cloth` | Trivial | Weak branding; rejected by product principle |
| D. Custom domains per shop | `baggacloth.in` | Per-domain cert + DNS guidance + verification | Phase 7 premium feature |

**Decision: Option A for v1**, with the resolver written so Option B can be added by
extending the host parser (no schema change). City sites remain
`bijnor.apnacity.com` (covered by the same wildcard).

DNS records (Cloudflare):
```
apnacity.com            A/AAAA  → edge
*.apnacity.com          CNAME   → edge        (covers bijnor., bagga-cloth., www.)
```

## 4. Request paths (three domains, one app)

| Host | App | Tenant context |
|------|-----|----------------|
| `apnacity.com`, `www.` | `apps/web` marketplace | none (city from user context) |
| `bijnor.apnacity.com` | `apps/web` city landing | city = Bijnor |
| `bagga-cloth.apnacity.com` | `apps/web` shop storefront | tenant = shop `bagga-cloth` |
| `seller.apnacity.com` | `apps/seller-portal` | from seller JWT |
| `admin.apnacity.com` | `apps/admin-portal` | from admin JWT |

Same Next.js build serves marketplace, city and shop storefronts — only data
fetching and chrome differ. This guarantees "upload once, visible everywhere"
without code duplication.

## 5. Cross-module communication

1. **In-process sync call** only through a module's *published interface*
   (exported service), never its repositories. Example: `orders` calls
   `inventory.reserve()` — allowed. `orders` calling `prisma.stock.update()` — forbidden.
2. **Async via transactional outbox** for anything that must not be lost:
   `order.placed`, `payment.captured`, `refund.completed`, `listing.published`,
   `kyc.approved`.
   - Write business row + outbox row in the **same DB transaction**.
   - BullMQ worker dispatches outbox → handlers in other modules → marks done.
   - Retry with exponential backoff; after N failures → dead-letter queue + alert.
   - Consumers are idempotent (dedupe by `event_id`).
3. **Domain events naming:** `aggregate.action.v1` (e.g. `order.child.accepted.v1`),
   payload versioned, schema in `packages/events`.

## 6. Key ports (interfaces) for swappability

| Port | v1 impl | Later impls |
|------|---------|-------------|
| `SearchPort` | Postgres FTS + `pg_trgm` + PostGIS | OpenSearch |
| `PaymentProviderPort` | Cashfree | Razorpay, Paytm |
| `NotificationChannelPort` | DLT SMS / FCM / email | WhatsApp Cloud API, IVR |
| `LogisticsPort` | in-house rider engine | Shadowfax, Shiprocket, Porter |
| `MediaStoragePort` | S3/MinIO + sharp | Cloudinary |
| `KycVerificationPort` | manual admin review | Digio/Protean API |
| `GeoCodingPort` | Google Maps | Mapbox |

## 7. Background jobs (BullMQ queues)

| Queue | Purpose | Trigger |
|-------|---------|---------|
| `outbox-dispatch` | deliver domain events | poll 1s |
| `media-process` | resize/webp/derivatives | upload |
| `search-index` | index listing/product upserts | outbox event |
| `notifications` | send SMS/push/WhatsApp/email | outbox event |
| `order-timers` | acceptance timeout, reservation TTL, auto-cancel | delayed jobs |
| `settlement-run` | nightly ledger settlement batches | cron |
| `reconciliation` | gateway ↔ ledger diff | cron |
| `imports` | bulk CSV product import | upload |
| `reports` | seller/city analytics exports | on demand |

Every queue: retry policy, DLQ, metrics, and idempotent handlers.

## 8. Environments

| Env | Purpose | Data |
|-----|---------|------|
| `local` | Docker Compose (pg+postgis, redis, minio, mailpit) | seeded demo data |
| `staging` | CI deploys on `main`; E2E + UAT | masked/anonymised copy |
| `production` | Deploy on tag `v*`; manual approval | real |

Secrets: environment variables only (Zod-validated `packages/config`), never in code.
Cloud secrets manager from Phase 5.

## 9. Monorepo tooling

- `pnpm` workspaces + `turbo.json` task graph (`build`, `lint`, `test`, `e2e`, `db:migrate`).
- Shared `tsconfig`, `eslint`, `prettier`, `jest`/`vitest` presets in `packages/config`.
- `packages/api-client` generated from OpenAPI on every API build (CI fails if stale).
- Enforce module boundaries with ESLint `no-restricted-imports` (app → packages only;
  api module → own module only, via `@apnacity/<module>` public API).

## 10. Module isolation & microservice extraction strategy (D-015)

The platform ships as a **modular monolith**, but every module is packaged so it
can be extracted into an independently deployable **microservice later without
changing any caller**. This is what makes "modify one module without breaking
others" safe at any stage.

### 10.1 Isolation rules (enforced from day 1)

1. Each module lives in `apps/api/src/<module>/` as a **self-contained unit**:
   `module.ts`, `controller.ts`, `service.ts`, `repository.ts`, `dto/`,
   `events/`, `policies/`, `*.spec.ts` — no files outside its folder.
2. A module exposes **one public barrel** (`index.ts`: service interfaces, DTO
   types, event names). Everything else is private. ESLint
   `no-restricted-imports` blocks deep imports (`@apnacity/inventory/...`
   deep paths forbidden; only `@apnacity/inventory` allowed).
3. A module owns its tables exclusively — **no other module may query them**,
   in code or raw SQL. Cross-module data needs: call the owner's public
   interface (sync) or subscribe to its events (async).
4. Contracts are typed in `packages/events` (event names + payload schemas,
   versioned `aggregate.action.v1`) — the *only* coupling allowed between modules.
5. External providers sit behind ports (§6) so vendor swaps never touch business modules.

### 10.2 When to extract a module (triggers)

- Independent scaling need (e.g. search indexing, notification fan-out).
- Independent deploy cadence or team ownership.
- Blast-radius isolation for a volatile area (e.g. payments).

### 10.3 Extraction playbook (per module — repeatable, 5 steps)

1. **Port-ify:** ensure all consumers already use the module's public interface
   (they do, per 10.1) — this is the seam.
2. **Shadow service:** deploy the module as its own app (`apps/<module>-service`)
   implementing the same interface over HTTP/queue; run in shadow mode behind a
   feature flag, comparing responses.
3. **Split data:** move its tables to a dedicated schema/database; sync via the
   same outbox events (or CDC). Keep event contracts byte-identical.
4. **Cutover:** flip consumers from in-process adapter to remote adapter
   (`<MODULE>_SERVICE_URL` env); monolith keeps working if the service is down
   only where the port contract allows degradation.
5. **Delete from monolith** once the service is stable; keep the barrel re-export
   pointing at the remote adapter so **no consumer code changes**.

Extraction is an ops decision, never a code rewrite. Per-module notes:
`12-module-build-cards.md` (each card lists its extraction path).



