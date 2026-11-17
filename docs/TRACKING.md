# APNACITY / HYPERECOM — PROJECT TRACKING & AGENT HANDOFF

> **Purpose:** any AI model, agent, or developer can pick up this project from
> exactly where it stands by reading this file first. It is the operational
> memory of the build. **Rule: every work session updates this file + commits.**
> Last updated: 2026-11-16 · **15/32 modules; Steps 1,2,4,5,6,7,8,9 DONE & deployed to cluster. Web redesigned (consumer-grade).**

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
| **M26** | **Audit module** | ✅ **DONE (b4353bf)** — append-only enforced by DB trigger (UPDATE/DELETE blocked, live-verified) · destructive ops require reason · keyset query · tests 6/6 |
| **M27** | **Outbox module** | ✅ **DONE (b47c9a9)** | table live on cluster DB (migration `20261105162201_add_outbox`) · publish-in-transaction + idempotent consumer + retry/backoff (1m→6h) → DEAD · typecheck 18/18 · tests 3/3 |
| — | Wireframes | ✅ DONE | `docs/WIREFRAMES.md` — 12 screens (home, search, PDP offers table, storefront, cart/checkout, tracking, seller inbox/wizard, rider, admin, city landing, mobile) |
| 2 | Database foundation (geography+identity tables, extensions, RLS, seed) | ✅ **DONE (2026-11-13)** | M03 geography live on cluster DB: 7 tables + postgis/pg_trgm/ltree + GiST indexes + zone_type CHECK + RLS (public-read) · seed: India + 36 states/UTs + Bijnor (city/localities/pincode/zone) · serviceability `ST_DWithin` verified · typecheck 18/18. **Pincode CSV (~19k) import deferred — §7.** |
| 3 | CI pipeline wiring (GHCR? or local registry + actions) | pending | |
| 4 | Auth + RBAC + tenancy (M27 M26 M30 M29 M01 M02) | ✅ **DONE (2026-11-13)** | OTP flow end-to-end on cluster DB (request→verify→tokens→/me); lockout 6th→423; refresh rotation + **reuse→family revoke (401)**; role claims in JWT; RBAC guard 403; `user.registered.v1` emitted. Tenant RLS on `shops` lands with M05. API tests 47/47. |
| 5–18 | Seller/shop → … → pilot | ▶️ **Steps 5,6,7,8,9 DONE · Steps 11–14 (purchase→OMS→delivery→notify/returns/support) DONE** | see guide PART III |

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
- [ ] **MinIO image unpullable** — `minio/minio:latest` fails on the node (Docker Hub rate-limit; pull returns HTML → ErrImagePull). **No longer blocks dev:** media runs on the disk driver (`MEDIA_STORAGE_DRIVER=disk`). For S3/MinIO later, fix the pull (docker login on the VM, or mirror into `localhost:32000`) OR use Cloudflare R2 (no image needed) and set `MEDIA_STORAGE_DRIVER=s3` + S3_* env.
- [ ] **Prod DB role must be non-superuser** — `apnacity` is SUPERUSER and bypasses RLS; create a non-superuser app role (verified with `app_rls`) for the API connection before any real tenant data.
- [ ] Import full India Post pincode CSV (~19k rows) into `pincodes` — M03 seed currently loads India + 36 states/UTs + Bijnor only; needs a trusted source CSV. Boundaries (locality/pincode MultiPolygon) also pending.
- [ ] Confirm/override decisions D-004…D-009 before Step 5
- [ ] Docker Desktop on the Mac still not installed (optional — cluster DB is the primary dev DB now)

## 8. How to continue (for any model/agent)

1. Read §1 docs. 2. Check §3 tracker for the next step. 3. Implement exactly the
   step's module sections from `docs/COMPLETE-BUILD-GUIDE.md` PART II. 4. Verify
   the step's gate. 5. Update §3 tracker + `docs/START-HERE.md` §1 + commit/push.
   For infra changes: also update `infrastructure/CLUSTER.md`.

## 9. Module-by-module build playbook (all 32 modules, in order)

> **Purpose:** the exact step-by-step work order for every module, in safe build
> order. Each module is a self-contained PR (or small set of PRs). A module is
> DONE only when its **Accept** tests pass AND its parent Step's **Verify gate**
> (PART III) is green. Source of truth: `COMPLETE-BUILD-GUIDE.md` PART II (module
> specs) + PART III (Steps/gates) + `spec/12-module-build-cards.md` (cards).
> **Legend:** ✅ done · ▶️ next · ⏳ pending.

### 9.0 The universal recipe (do these 7 steps for EVERY module)

Every module card below expands into the same seven steps — do them in order:

1. **Load context** — the module's PART II section + its card in `spec/12` + the
   *Refs* that card lists. Load nothing else.
2. **Schema** — add the module's tables to the Prisma schema; write one migration;
   apply to the cluster DB (`DATABASE_URL=…:30432`, command in `CLUSTER.md`).
   Add RLS policy + `shop_id` where the table is tenant-scoped.
3. **Port (interface)** — define the module's public `*Port` in `packages/*` /
   the module's port file. Cross-module calls go ONLY through this port (sync) or
   outbox events (async) — rule §5.3.
4. **Service (logic)** — implement the port inside the NestJS module. Honour the
   hard rules §5 (paise, UTC, UUID, snapshots, one-transaction state changes).
5. **Endpoints** — add controllers for the endpoints in the card; update Swagger
   + regenerate the API client (`packages/api-client`).
6. **Events** — emit `events out` via `OutboxPort` (M27) in the same transaction;
   wire `events in` as idempotent consumers. Record audit (M26) for privileged ops.
7. **Tests + gate** — write the card's **Accept** tests; run
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; confirm the parent
   Step's **Verify gate**. **For API modules: the boot test (`apps/api/src/app.boot.spec.ts`)
   must stay green — it compiles the whole NestJS DI graph and catches wiring errors
   (interface/defaulted constructor params) that `tsx` hides but the compiled container
   hits.** Then update §3 tracker + `START-HERE.md` + commit.

### 9.1 Master sequence (32 modules → Step → gate)

| # | Module | Step | Status | Parent-Step Verify gate (must pass) |
|---|--------|------|--------|--------------------------------------|
| 1 | M27 outbox | 1–2 | ✅ | lost-update atomic; DLQ alert; dup consumer ignored |
| 2 | M26 audit | 4 | ✅ | privileged action w/o audit fails; tamper rejected |
| 3 | M30 idempotency | 4 | ✅ | replay returns original response + same status |
| 4 | M29 feature-flags | 4 | ✅ | flag change visible ≤30 s; default-safe if table down |
| 5 | M01 auth | 4 | ✅ | OTP; lockout; refresh-reuse→family revoke; revoked 401 |
| 6 | M02 users | 4 | ✅ | CITY_ADMIN cross-city denial; one user multi-role |
| 7 | M03 geography | 2 | ✅ | migrations+seed; RLS 0-rows w/o tenant; Bijnor seeded |
| 8 | M10 media | 6 | ✅ | signed upload→WebP 256/512/1024 <10 s; spoof reject; quota |
| 9 | M04 sellers | 5 | ✅ | KYC transitions; rejected→resubmit; docs private |
| 10 | M05 shops | 5 | ✅ | slug race 1-winner; suspend→listings PAUSED; branding |
| 11 | M06 shop-domains | 5 | ✅ | `{slug}.apnacity.com` resolves tenant; unknown host 404 |
| 12 | M07 catalog | 5–7 | ✅ | GTIN dedupe; attr schema validation; merge redirects |
| 13 | M08 listings | 7 | ✅ | publish validation matrix; price history; offers query |
| 14 | M09 inventory | 8 | ✅ | **100 parallel on stock=10 → exactly 10**; TTL; recon |
| 15 | M11 search | 10 | ✅ | golden set; typo tolerance; p95 <300 ms @50k |
| 16 | M12 cart | 11 | ✅ | anon→user merge; drift detection; ≤50 items cap |
| 17 | M15 payments | 11 | ✅ | replay ignored; bad signature 400; partial-refund math |
| 18 | M14 orders | 11–12 | ✅ | full transition matrix; 10-min auto-reject; partial cancel |
| 19 | M13 checkout | 11 | ✅ | 3-shop split; idempotent replay; per-item 422; quote expiry |
| 20 | M20 promotions | 11 | ◑ | scope/window/limit stacking; free-delivery one shop group |
| 21 | M17 delivery | 13 | ✅ | scoring order; OTP fail path; reverse-logistics job |
| 22 | M18 delivery-partners | 13 | ✅ | offline 5 min→unavailable; weekly earnings aggregation |
| 23 | M19 returns | 14 | ✅ | window expiry; auto-approve gate; inspection-failed freeze |
| 24 | M22 notifications | 14 | ✅ | **SMS w/o DLT id fails closed**; <5 s p95; opt-out suppress |
| 25 | M23 support | 14 | ✅ | SLA timers; dispute freezes refund |
| 26 | M24 admin | 16 | ✅ | every action audited; approval queue SLA; commission audit |
| 27 | M16 finance | 15 | ✅ | worked example exact; **ledger == gateway to the paisa** |
| 28 | M31 invoicing | 15 | ✅ | invoice per child order; series numbering; credit note |
| 29 | M25 analytics | 16 | ✅ | rollup correctness; tenant scoping; no PII in dashboards |
| 30 | M28 webhooks | 11/15+ | ✅ | HMAC; retry 1m/5m/30m/2h/6h; subscription mgmt |
| 31 | M32 content | 18 | ⏳ | city landing/banner/FAQ CMS CRUD + public read |
| — | M21 reviews | P4 | ⏳ | one review/item; verified-purchase; aggregate recompute |

### 9.2 Per-module work orders

Each block = **Prereq · Tables · Port · Endpoints · Events · Key rules · Accept**.
Apply the §9.0 seven-step recipe to each.

**M30 idempotency** ✅ DONE (foundation) — Prereq: — · Tables `idempotency_keys` ·
Port: NestJS interceptor `Idempotency-Key`→hash→stored response (24 h) · Accept:
replay returns original response + same status. *Service + interceptor + module in
`apps/api/src/idempotency/`; table live on cluster DB (migration add_idempotency_keys);
tests 3/3.*

**M29 feature-flags** ✅ DONE — Prereq: — · Tables `feature_flags` · Port `FlagsPort.eval(keys,ctx)`
(30 s cache) · Accept: flag change ≤30 s; default-safe when table unreachable. *Pure
`evaluateFlag` core (rule precedence/context/percentage) + cached DB eval with safe
fallback in `apps/api/src/feature-flags/`; tests 12/12 (6 pure-core + 6 service).*

**M01 auth** ✅ DONE — Prereq M27,M26,config · Tables: Redis sessions (users via M02) ·
Port `AuthPort` issueTokens/verifyAccess/rotateRefresh/revokeFamily + OTP · Endpoints `/auth/*` (request/verify/refresh/logout/me) ·
Events out `user.registered.v1` · Rules OTP hashed+peppered TTL5m, 5-attempt→15m lock,
JWT15m, refresh rotation+reuse-detection · Accept: lockout; reuse-revoke; revoked 401; role claims.
*Crypto core + RefreshFamilyService + AuthService + controller + JWT/Roles guards in
`apps/api/src/auth/`; tests 22/22 (crypto 11, refresh 5, guards 6); **verified end-to-end
on cluster DB.** DEV: in-memory OTP store + console SMS — SWAP to Redis + DLT (M22);
node:crypto scrypt+HMAC — SWAP to argon2id+jose.*

**M02 users** ✅ DONE — Prereq M01 · Tables `users,customer_profiles,addresses,roles,permissions,role_permissions,user_roles`
live on cluster DB (migration `add_users_rbac`) · Port `UsersPort` profiles/addresses(geocode-on-save)/role-grants ·
`/me` + `/me/addresses` controllers (JWT-guarded) · Events out `address.created.v1` ·
Accept: CITY_ADMIN cross-city denial (`canActInCity`, tests 4/4); one user multi-role.
*Geocode-on-save reads `geocode_cache`; address create emits event in one tx.*

**M03 geography** (Step 2 — DB foundation) — Prereq packages/db · Tables
`countries/states/cities/localities/pincodes, delivery_zones, geocode_cache` +
extensions postgis/pg_trgm/ltree + RLS · Port `GeoPort` serviceable?/zoneFeeETA/detect/pincode ·
Endpoints `/geo/*` (24 h cache) · Accept: point-in-polygon boundaries; pincode fallback; fee slab; Bijnor seeded.

**M10 media** ✅ DONE (logic+tests) — Prereq M27,S3 port · Tables `media` · Port `MediaPort` signedUploadUrl/attach/variants ·
Events out `media.processed.v1` · Rules MIME allowlist+sniff, ≤6 img/listing, WebP 256/512/1024, EXIF strip, private bucket for DOCUMENT ·
Accept: spoof reject; derivative <10 s; quota; private URLs expire.
*Pure core (MIME allowlist, magic-byte sniff/anti-spoof, size/quota/count, bucket routing,
derivative plan) + MediaService (presign→complete→media.processed.v1) + controller in
`apps/api/src/media/`. **Storage is pluggable via `MEDIA_STORAGE_DRIVER` (config):** `disk`
(default, dev — real files on a volume, NO S3/MinIO needed) or `s3` (AWS S3 / Cloudflare R2 /
MinIO, SigV4 presign via node:crypto, zero new deps). S3_* env required only when driver=s3
(enforced at boot). Tests 26: 13 core + 5 disk round-trip + 4 toggle + 3 integration (spoof→REJECTED,
private signed URL). **MinIO container deferred (Docker Hub rate-limit) — dev unblocked via disk driver;**
prod fills S3_* in `.env.example` MEDIA/STORAGE block. Real image resize (sharp) + virus scan still
run in the process worker when enabled — §7.*

**M04 sellers** ✅ DONE — Prereq M01,M02,(M10 media deferred),M24 · Tables `sellers,kyc_documents,bank_accounts` ·
Port `SellersPort` register/submitKyc/status/listForAdmin · Events out `kyc.submitted/approved.v1` ·
Rules PAN+GSTIN checksum, docs private bucket, state machine 06§6 · Accept: KYC transitions; resubmit; docs not public.
*Pure core (PAN/GSTIN checksum, KYC state machine) + SellersService + controller in
`apps/api/src/sellers/`; media_id nullable until M10. Tests 13 core + integration. GSTIN mod-36 checksum implemented.*

**M05 shops** ✅ DONE — Prereq M04,M03,M10 · Tables `shops,shop_settings` · Port `ShopsPort`
create(slug)/update/suspend/settings/resolveBySlug · Events out `shop.created/updated/suspended.v1` ·
Accept: slug race 1-winner; suspend cascades listings→PAUSED; branding renders.
*ShopsService: transactional slug allocation (collision→-2), auto-provisions shop_domain + shop_settings,
emits shop.created.v1. **Tenant RLS on shops/shop_settings/shop_domains applied + FORCED** (migration
`shops_tenant_rls`) — verified: non-superuser `app_rls` sees 0 rows without `app.current_tenant`, 1 with
matching, 0 with wrong. ⚠️ `apnacity` DB role is SUPERUSER (bypasses RLS) — **prod must connect as a
non-superuser role.** Listing→PAUSED cascade stubbed until M08.*

**M06 shop-domains** ✅ DONE — Prereq M05,M03 · Tables `shop_domains` · Port `resolveTenant(host)`→{shopId,slug,cityId} ·
Endpoints `GET /internal/resolve-tenant`, `GET /storefront/resolve` · Accept: cache+invalidation on rename; unknown host 404.
*Subdomain `{slug}.apnacity.com` provisioned on shop create; resolve endpoints return 404 on unknown host.
HMAC signing + Redis 60s cache are the remaining prod hardening.*

**M07 catalog** ✅ DONE — Prereq M10,M24 · Tables `categories,brands,products,product_variants,product_media,match_groups` ·
Port `CatalogPort` categories/tree/attributeSchema/createProduct/variants/mergeQueue ·
Events out `product.created/merged.v1` · Rules GTIN auto-match, trigram>0.75→human merge, attr schema snapshot ·
Accept: GTIN dedupe; schema validation; merge redirects listings.
*Pure core (attr-schema validation, GTIN normalize) + CatalogService (matchOrCreate: GTIN dedupe →
schema validation → trigram fuzzy-match into match_group → create + snapshot + product.created.v1;
mergeGroup redirects listings to canonical). FTS gin + trigram indexes live. Tests 8 core + integration.*

**M08 listings** ✅ DONE — Prereq M07,M09,M10,M05 · Tables `seller_listings,listing_variants,price_history` ·
Port `ListingsPort` publishDraft/quickEdit/pause/resume/byShop/byProduct · Events out `listing.published/updated/paused.v1` ·
Rules price≤MRP, publish needs images+attrs+stock, auto OUT_OF_STOCK at 0 · Accept: publish matrix; price history; offers same-variant.
*Pure core (publish-validation matrix, price≤MRP, availability→status) + ListingsService (createDraft,
quickEdit→price_history, publish w/ validation→listing.published.v1, pause/resume, offers same-variant
across shops). **Tenant RLS on seller_listings + listing_variants (FORCED)** + price≤MRP CHECK live.
Tests 8 core + 4 integration (**full flow: product→draft→publish-gate→ACTIVE→offers→price_history**).
Stock=0→OUT_OF_STOCK + search delist wire with M09 (inventory, Step 8).*

**M09 inventory** ✅ DONE — Prereq M08,M27 · Tables `inventory_locations,stock,stock_movements,stock_reservations` ·
Port `InventoryPort` reserve/release/consume/adjust/availability · Events in `listing.published.v1`,cancellations; out `stock.low/out/reconciled.v1` ·
Rules atomic conditional UPDATE only, movements append-only same-tx, TTL 30 min, nightly recon ·
Accept: **100-parallel no-oversell**; TTL restore; zero-drift; RLS.
*InventoryService: the ONLY mutation is the atomic `UPDATE ... WHERE on_hand-reserved >= qty`
(0 rows → reject). reserve/release/consume/adjust each write a stock_movements row in the same tx.
DB CHECK(reserved<=on_hand, non-negative) + tenant RLS (FORCED) on inventory_locations.
**Verified live: 100 parallel reservations on stock=10 → EXACTLY 10 succeed, reserved never
exceeds on_hand.** Tests 5 integration (no-oversell, availability, release-restores, consume, recon).
Event wiring (listing.published→init stock; stock.out→M08 OUT_OF_STOCK + search delist) + nightly
reconcile CronJob are the remaining cross-module hookups (Step 11/order-timers + ops).*

**Step 9 — Storefront / Marketplace / PDP (web app)** ✅ DONE & DEPLOYED — `apps/web` (Next.js 15):
- **Consumer-grade redesign** (2026-11-16, after review): design-token system (teal/saffron
  palette, surfaces, shadows, status colors w/ icons), `components/ui.tsx` primitives
  (TopBar, ProductImage placeholder, StarRating, StockBadge, Price, Section). No emoji —
  real aspect-ratio image slots ready for uploads.
- **Home** `/` — hero, category rail, trust strip, product cards (price/discount hierarchy,
  rating, stock, ETA). **PDP** `/product/[id]` — gallery+thumbs, size chips, "Best price in
  your city" block, **offers comparison as shop cards w/ BEST PRICE badge**, sticky mobile
  buy bar, JSON-LD Product/AggregateOffer. **Storefront** `/shop/[slug]` — branded banner,
  shop header + KYC/returns trust row, catalogue grid, JSON-LD Store. robots.txt + sitemap.xml.
- Public API reads: `GET /categories`, `/products/:id`, `/products/:id/offers`, `/shops/:id/catalogue`.
  Typed `@apnacity/api-client`; `safe()` demo fallback.
- **LIVE on cluster**: all 3 routes 200, redesign markers + custom brand CSS present, real
  seeded prices (₹769/799/849) render via web→API→Postgres. Verified by live HTML inspection.
- **Remaining:** offers API returns price+shopId only — shop name / distance / ETA / rating
  enrichment (needs M03 distance + shop-name join + reviews) is a follow-up; shown via demo
  fallback until then.

**M11 search** ✅ DONE (Step 10) — Prereq M08,M03 · Tables `search_synonyms`+projections · Port `SearchPort` query/suggest/synonyms ·
Events in `listing.*,product.*,stock.*` · Rules Postgres FTS+trigram+PostGIS, rank relevance×in-stock×rating, city-first, sponsored explicit ·
Accept: golden set; typo tolerance; p95 <300 ms @50k.

**M12 cart** — Prereq M08,M09 · Tables `carts,cart_items` · Port `CartPort` get/addItem/updateQty/remove/mergeAnonymous ·
Rules drift surfaced on read, ≤50 items, one open cart/user · Accept: anon→user merge; drift; caps.

**M15 payments** — Prereq M27,M30,PaymentProviderPort(Cashfree) · Tables `payments,payment_transactions,refunds,webhook_events` ·
Port `PaymentsPort` createIntent/handleWebhook/refund · Events out `payment.captured.v1,refund.completed.v1` ·
Rules webhook=only capture authority, signature+timestamp+replay, COD recon · Accept: replay ignored; bad sig 400; partial refund math.

**M14 orders** ✅ DONE (Step 12) — Prereq M09,M15,M27 · Tables `orders,seller_orders,order_items,order_events` ·
Port `OrdersPort` transition(state machine)/cancelOrder/sweepTimeouts · Events out `order.placed/child.*.v1` ·
Rules transitions validated (role×from→to else 409), timers 10-min accept, snapshots immutable · Accept: full matrix; timeout auto-reject; partial-cancel; event history.
*Pure state machine (orders.core: child + parent transitions, stock-release/consume/refund flags) +
OrdersService (one-tx transition: event row + stock release/consume via atomic UPDATE + refund row +
re-derive parent). Tests 11 core + 5 integration (accept→dispatch consumes stock; reject releases +
refund + PARTIALLY_CANCELLED; 10-min timeout sweep; illegal/forbidden → 409). Fixed spec bug:
orders.status varchar(18)→(20) ('PARTIALLY_CANCELLED' is 19 chars). **Remaining:** delivery/return
transitions wire to M17/M19 (Steps 13–14); timer sweep needs a CronJob (ops).*

**M13 checkout** — Prereq M12,M03,M20,M15,M09,M14 · Tables: none (orchestrates) ·
Port `CheckoutPort` quote(TTL10m)/place(Idempotency-Key)→orderId · Rules single-transaction place (order+children+items+reservations+outbox+payment), stock short→422, COD gates ·
Accept: 3-shop split totals; idempotent replay; 422 flow; quote expiry.

**M20 promotions** — Prereq M13 · Tables `coupons,coupon_redemptions,campaigns` · Port `PromotionsPort` validate(cart,code)→discount lines+redemption ·
Accept: scope/window/limit stacking; free-delivery one shop group.

**M17 delivery** ✅ DONE (Step 13) — Prereq M14,M03,M18 · Tables `delivery_jobs,tracking_events,proof_of_delivery` ·
Port `DeliveryPort` createJob/assign(scoring)/accept/reject/status/issueOtp/verifyOtp/fail/tracking ·
Events out `delivery.delivered/failed.v1` · Rules score=0.4/dist+0.3/(1+jobs)+0.2·rating+0.1·fit, 60 s offer, retry×2→return-to-seller ·
Accept: scoring order; OTP fail; reverse-logistics job.
*Pure core (eligibility, scoring formula, 4-digit OTP hash/verify w/ 3-attempt lock, fee/ETA) +
DeliveryService (create job w/ PostGIS pickup/drop, assign best→60-s offer + auditable reason,
reject→re-offer next, OTP verify→DELIVERED+PoD+delivery.delivered.v1, failed×2→RETURNED_TO_SELLER
reverse job). Tests 9 core + 4 integration (scoring order, re-offer, OTP path, reverse job).*

**M18 delivery-partners** ✅ DONE (Step 13) — Prereq M01,(M24 KYC),(M16 earnings) · Tables `delivery_partners,delivery_partner_zones` ·
Port `RidersPort` register/availability/ping(PostGIS)/earnings · Accept: offline 5 min→unavailable; weekly earnings.
*RidersService: register, availability, location ping (ST_MakePoint), sweepOffline (>5 min stale →
unavailable), earnings (sum delivered job fees since date). Tested via integration (offline sweep).
**Remaining:** rider KYC approval via M24; earnings → M16 ledger payout (Step 15); offer-timeout +
offline sweeps need CronJobs (ops); customer live-tracking endpoint + rider app offline queue.*

**M19 returns** ✅ DONE (Step 14) — Prereq M17,M15,M23 · Tables `return_requests` · Port `ReturnsPort` request/approve/reject/inspection ·
Events out `return.approved.v1`→M17 job+M16 refund · Accept: window expiry; auto-approve gate; inspection-failed freeze.

**M22 notifications** ✅ DONE (Step 14) — Prereq M27,channel ports(DLT/FCM/WhatsApp/email) · Tables `notification_templates,notifications,notification_preferences` ·
Port `NotifyPort` send(templateCode,recipient,vars)/preferences · Events in all order/payment/delivery/settlement ·
Rules **DLT template id mandatory for SMS (fail-closed)**, fallback chain, quiet hours · Accept: fail-closed; <5 s p95; opt-out.

**M23 support** ✅ DONE (Step 14) — Prereq M14 · Tables `support_tickets,ticket_messages` · Port `SupportPort` open/reply/escalate/resolve + dispute freeze into M15/M19 ·
Accept: SLA timers; dispute freezes refund.

**M24 admin** ✅ DONE (Step 16) — Prereq M04/M05/M18 approvals,M26 · Provides admin ops APIs + two-person payout rule (with M16) ·
Accept: every action audited; approval queue SLA; commission change audited.

**M16 finance** ✅ DONE (Step 15) — Prereq M15,M14,M31 · Tables `ledger_accounts,ledger_entries,settlements,settlement_items,commissions` ·
Port `FinancePort` post/sellerBalance/runSettlement/statement · Events in `payment.captured.v1,refund.*,delivery.delivered.v1` ·
Rules balanced-per-transaction trigger, append-only, T+2 settlement, TCS/TDS, two-person payout · Accept: worked example exact; **gateway recon to the paisa**.

**M31 invoicing** ✅ DONE (Step 15) — Prereq M14,M16 · Tables `invoices,credit_notes` · Port `InvoicePort` generate/creditNote/GST series + e-invoice IRN hooks ·
Accept: invoice per child order; numbering per series; credit note on refund.

**M25 analytics** ✅ DONE (Step 16) — Prereq M27 · Tables `analytics_events`(partitioned)+rollups · Port `AnalyticsPort` track/dashboards/exports ·
Accept: rollup correctness; tenant scoping; no PII in dashboards.

**M28 webhooks** ✅ DONE — Prereq M27,M30 · Tables `webhook_subscriptions` · Provides outbound subscriptions (HMAC, retries 1m/5m/30m/2h/6h)+mgmt API.

**M32 content** — Prereq M24 · Tables `pages,banners,faqs` · Provides city landing/banner/FAQ CMS CRUD + public read APIs.

**M21 reviews** (Phase 4, post-delivery) — Prereq M14 · Tables `reviews` · Port `ReviewsPort` submit(verified orderItem)/moderate/aggregates ·
Accept: one review/item; verified-purchase enforced; aggregate recompute exact.

> **Next action now:** **Steps 1,2,4,5,6,7,8,9 deployed + Steps 11–15 built & gate-green;
> Step 3 CI (Jenkins) LIVE & GREEN (build #3, 173 tests).** Built: …M14 M17 M18 M19 M22 M23
> **M16** (+M20/M31 partial) = **25/32**. Money truth done: double-entry ledger (balanced +
> append-only by DB trigger), commission, T+2 settlement w/ two-person release. Full suite
> 186 tests. Next = **Step 10 M11 search** OR **M24 admin** OR **M21 reviews** OR **M31 invoicing**
> (finishes Step 15) OR deploy 11–15. Remaining: M11, M24, M25, M28, M31, M32, M21.
> **Jenkins:** http://192.168.2.224:32080/job/apnacity — auto-trigger (webhook) + in-CI image
> build still TODO. Cashfree keys needed; timer/SLA sweeps need CronJobs; event orchestration manual.
