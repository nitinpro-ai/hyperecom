# APNACITY — COMPLETE BUILD GUIDE (MASTER DOCUMENT)
### Hyperlocal Multi-Vendor E-Commerce Marketplace — Module-by-Module Build Specification

> **One self-contained document.** Organized **per module (M01–M32)** — every module
> carries its complete detail: purpose, workflow, database tables (SQL), API
> endpoints with examples, business rules, events, screens and acceptance tests.
> The master build **sequence** (Steps 0–18) and dependency graph are in the final
> sections. Share this document alone; nothing else is required to build.
>
> **How to build with an AI agent:** say *"Build M09"* → the agent implements only
> that module's section below, respecting its Prerequisites and acceptance tests.
> Follow the sequence in §BUILD SEQUENCE (Steps 0–18).

**Stack:** Next.js 15 · NestJS · PostgreSQL 16 + PostGIS · Prisma · Redis + BullMQ ·
React Native + Expo · S3 + Cloudflare CDN · Cashfree · Docker · GitHub Actions.

---

## 1. PLATFORM OVERVIEW

**What:** city-first marketplace ("Amazon for local shops"). Customer selects
**state → city**, searches products, sees **offers from local shops** (price,
distance, stock, ETA), compares across shops, orders with local delivery.
Every shopkeeper gets an **automatic website** (`bagga-cloth.apnacity.com`);
a product uploaded once appears on the shop site, the marketplace, city search
and mobile apps. One shared backend: orders, delivery (riders + shop self),
returns, payments, commission and double-entry settlement.

**Surfaces (one backend):** ① marketplace `apnacity.com` + city sites
`bijnor.apnacity.com` ② auto shop storefronts `{slug}.apnacity.com`
③ seller portal (PWA) `seller.apnacity.com` ④ admin portal ⑤ customer app
⑥ seller + rider apps (Android/iOS).

**Roles:** SUPER_ADMIN · CITY_ADMIN (one city) · SELLER_OWNER · SELLER_STAFF ·
CUSTOMER · DELIVERY_PARTNER · CUSTOMER_SUPPORT. Three enforcement layers:
JWT claims → route policies → Postgres RLS.

## 2. GLOBAL CONVENTIONS (apply to every module)

- Money: `bigint` **paise**, INR only. Dates: UTC `timestamptz`, display in IST.
- IDs: `uuid` internal; human order numbers `APN-2026-000123`.
- Tenant = shop. Tenant tables carry `shop_id` + RLS policy
  `USING (shop_id = current_setting('app.current_tenant')::uuid)`.
- Cross-module access **only** via published ports (sync) or outbox events
  (async, names `aggregate.action.v1`). A module never touches another's tables.
- Mutating POSTs take `Idempotency-Key` (24 h). Payment webhooks: signature +
  timestamp + replay-verified.
- Status changes: validated state machine + immutable event row + outbox, in one
  transaction. Errors: RFC-style envelope with `code/message/details/traceId`.
- `created_at/updated_at timestamptz default now()` on every table (omitted below).
- No fake APIs, no placeholders, no hardcoded business data.

## 3. ARCHITECTURE SUMMARY

Modular **monolith** (one NestJS deployable, one Postgres) — every module
self-contained and **microservice-extractable** (port-ify → shadow service →
split data via events → cutover `<MODULE>_SERVICE_URL` → delete from monolith;
no caller changes).

```
web(marketplace+city+shop) · seller-portal · admin-portal · mobile×3
   → Cloudflare edge (CDN/WAF/rate-limit) + host→tenant middleware
   → NestJS API (32 modules) → Postgres+PostGIS (truth, RLS) · Redis/BullMQ · S3
   → Cashfree · DLT SMS · WhatsApp · FCM/APNs · Maps
```

- **Host→tenant:** middleware parses host → `GET /internal/resolve-tenant` (Redis
  60 s cache, HMAC `x-tenant-proof`) → tenant context. Slug allocation transactional.
- **Domains/TLS:** `shop.apnacity.com` single-level → one wildcard `*.apnacity.com`
  covers everything (`shop.city.apnacity.com` would need per-city wildcards — later option).
- **Jobs (BullMQ):** outbox-dispatch · media-process · search-index ·
  notifications · order-timers · settlement-run · reconciliation · imports · reports.
- **Environments:** local (Docker Compose: postgis/redis/minio/mailpit) → staging
  (auto on main) → production (tag + manual approval, blue/green).
---

# PART I — END-TO-END WORKFLOWS (what the modules together must deliver)

## W1. Seller onboarding (shop live < 15 min)
1. Mobile OTP (`POST /auth/otp/request` → SMS) → verify (`/auth/otp/verify`) → user + SELLER_OWNER.
2. Shop basics: shop name, owner name, state/city, address, pincode → `POST /sellers/register` (sellers DRAFT + addresses).
3. Business: type, PAN, GSTIN (optional), bank + IFSC → `PATCH /sellers/me`.
4. KYC docs (PAN card photo, shop photo, bank proof) → signed upload → `kyc_documents` (private bucket).
5. Branding: logo, banner, description, categories, opening hours → `PATCH /shops/{id}`.
6. Submit → `sellers.status=KYC_PENDING` → admin approval (24 h SLA) →
   `APPROVED` + `shops.status=ACTIVE` + slug + `shop_domains` row → seller notified
   "Your shop is live at bagga-cloth.apnacity.com" (SMS+WhatsApp).

## W2. Product upload (5-step wizard, < 60 s/product)
1. **Photos** (camera/gallery, ≤6, jpeg/png/webp ≤5 MB, client-compress).
2. **Details:** name (3–120), category (tree), brand, description, attributes per
   category schema (size[], color[]…).
3. **Variants & price:** per variant SKU, MRP, price (≤ MRP), tax %, stock qty.
4. **Delivery:** weight, dims, pickup location, mode.
5. **Publish** — one transaction: listing `ACTIVE`, stock rows, search index,
   storefront revalidate. GTIN match → attach to existing master; fuzzy ≥0.75 →
   admin merge queue. Bulk CSV import (500 rows < 5 min, row-level errors).
   AI title/description (feature-flagged, seller confirms).

## W3. Customer discovery
GPS/pincode/manual → city → home (categories, featured shops, popular, offers) →
search `GET /search` (city + serviceable only) → filters (price/brand/size/color/
shop/availability/distance/rating) → sorts (price, nearest, fastest, rating) →
PDP with **offers table per variant** (shop, distance, stock, ETA, rating,
"lowest price" badge) → shop storefront or marketplace shop profile.

## W4. Purchase
Cart (multi-shop, drift surfaced per item) → quote (per-shop fee/ETA + coupon,
TTL 10 min) → payment intent (Cashfree; COD risk-gated) → pay → webhook
(verified) → **one transaction**: parent order + child orders per shop +
snapshotted items + atomic stock reservations + events + outbox → notify
customer + each seller (<5 s). Quote expiry 15 min → auto-cancel.

## W5. Fulfilment (seller)
New order (inbox+sound+push, 10-min accept deadline) → accept (customer notified,
delivery job created) / reject (reason → refund child) / timeout (auto-reject) →
preparing → ready → dispatch (reservation consumed). Cancellations: customer free
pre-accept; policy-based later; partial cancels recompute totals; all audited.

## W6. Delivery
Modes per shop: PLATFORM_RIDER or SELLER_SELF (same model). Assignment when
READY: candidates = available, ≤3 km, vehicle fits, ≤2 active jobs;
**score = 0.4/distance + 0.3/(1+jobs) + 0.2×rating + 0.1×vehicle**; 60-s offer
window → next rider. Chain: ASSIGNED→ACCEPTED→AT_PICKUP→PICKED_UP→IN_TRANSIT→
AT_DROP→DELIVERED (4-digit OTP hash + PoD photo/signature; 3 wrong → support).
Failed ×2 → return-to-seller reverse job. Rider app: offline queue, GPS 15 s,
earnings weekly. Returns pickup = reverse chain.

## W7. Returns & refunds
Request per item (reason + photos) → window check (7 d default; non-returnables) →
auto-approve ≤ ₹500 {SIZE_ISSUE, CHANGED_MIND} no-abuse → pickup job → RECEIVED →
INSPECTION (pass/fail) → refund (original method or UPI for COD) → notify; fail →
dispute ticket, refund frozen, admin resolves. Restock via `stock_movements(RETURN)`.

## W8. Money
Platform collects 100% (Cashfree). Ledger postings per child order: capture,
commission (config: category × city, seller override), gateway fee, refund
clawback, COD holding, TCS lines (CA config). Settlement: nightly batch of CLOSED
children → T+2 payout via gateway split after **two-person approval** → statement
PDF. Reconciliation job: ledger vs gateway report daily (alert on any diff).

## W9. Notifications
SMS = DLT templates only (fail-closed); WhatsApp approved templates; push-first
non-critical; quiet hours for promos; per-topic opt-out. Key sends: order placed
(customer confirm + **seller alert <5 s**), accepted/rejected, out-for-delivery +
OTP SMS, delivered, return steps, settlement paid, stock low, KYC approved.

## W10. Admin daily ops
Approval queues (KYC/shops/riders, 24 h SLA) → merge queue → order/dispute
console (full event timeline) → refunds > limit → COD recon mismatches →
settlement payout release → config (taxonomy/commissions/zones) → flags →
city analytics. Every action audited with before/after.
---

# PART II — THE MODULES (M01–M32, complete build detail per module)

> Module format: Purpose · Build info · Workflow · Tables (SQL) · APIs · Rules ·
> Events · Screens · Acceptance. Sections are ordered M01→M32 (index below);
> BUILD order differs — foundation modules first — see the dependency graph at
> the end of this part and PART III.
## Module index — ALL 32 modules (M01–M32) in this part

> Sections below are ordered **M01 → M32**. Foundation modules (M26 M27 M29 M30)
> appear at their numeric positions but are **built first** — see the dependency
> graph at the end of this part and PART III Steps 0–18 for build order.

| Module | What it is | Where |
|---|---|---|
| M01 | Auth | own section |
| M02 | Users, Profiles & RBAC | own section |
| M03 | Geography & Serviceability | own section |
| M04 | Sellers & KYC | grouped with M05, M06 |
| M05 | Shops | grouped with M04, M06 |
| M06 | Shop Domains | grouped with M04, M05 |
| M07 | Catalog (categories, brands, master products, variants, matching) | own section |
| M08 | Listings (a shop's offer) | own section |
| M09 | Inventory (stock truth) | own section |
| M10 | Media | own section |
| M11 | Search & Discovery | own section |
| M12 | Cart | own section |
| M13 | Checkout (quote + place-order orchestration) | own section |
| M14 | Orders (OMS + state machines) | own section |
| M15 | Payments | own section |
| M16 | Finance (ledger, commission, settlement) | grouped with M31 |
| M17 | Delivery Engine | grouped with M18 |
| M18 | Delivery Partners | grouped with M17 |
| M19 | Returns | own section |
| M20 | Promotions | own section |
| M21 | Reviews | own section |
| M22 | Notifications | own section |
| M23 | Support & Disputes | own section |
| M24 | Admin Ops | grouped with M25, M28, M32 |
| M25 | Analytics | grouped with M24, M28, M32 |
| M26 | Audit (Foundation) | own section |
| M27 | Outbox (Foundation) | own section |
| M28 | Webhooks | grouped with M24, M25, M32 |
| M29 | Feature Flags (Foundation) | own section |
| M30 | Idempotency (Foundation) | own section |
| M31 | Invoicing (GST) | grouped with M16 |
| M32 | Content (CMS) | grouped with M24, M25, M28 |

## M01 — Auth
**Purpose:** OTP login (customers + sellers + riders), optional password, JWT sessions.
**Build:** Phase 0 · Step 4 · after M27/M26. **Extract:** identity service.
**Workflow:** request OTP → SMS (DLT) → verify → account auto-created (first time) +
roles → JWT pair. Password: optional set/reset (argon2id).
**Tables:** none own (users via M02; sessions/OTP in Redis: `otp:{phone}` hash+attempts,
`refresh:{family}`).
**APIs:** `POST /auth/otp/request {phone}` → `{resendIn:60}`;
`POST /auth/otp/verify {phone, otp}` → `{accessToken, refreshToken, user}`;
`POST /auth/refresh` (rotating); `POST /auth/logout`; `GET /auth/me`;
`POST /auth/password/reset-request|confirm`.
**Rules:** OTP 6-digit, hash+pepper, TTL 5 min, 5 wrong → 15 min lock, resend 60 s;
rate limit per phone AND IP; access JWT 15 min claims `{sub, roles, shopId?, cityId?}`;
refresh rotates, reuse of consumed token revokes whole family (theft detection).
**Events out:** `user.registered.v1`. **Screens:** mobile/web OTP screens.
**Acceptance:** lockout; family revoke; revoked access 401; role claims correct.
## M02 — Users, Profiles & RBAC
**Purpose:** profiles, addresses (geocoded), role grants. **Build:** Phase 0 · Step 4.
**Tables:**
```sql
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone varchar(15) UNIQUE NOT NULL, email citext UNIQUE, password_hash text,
  name text NOT NULL, locale varchar(2) DEFAULT 'EN' CHECK (locale IN ('EN','HI')),
  status varchar(10) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','BLOCKED','DELETED')),
  last_login_at timestamptz);
CREATE TABLE roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(20) UNIQUE NOT NULL CHECK (name IN ('SUPER_ADMIN','CITY_ADMIN',
  'SELLER_OWNER','SELLER_STAFF','CUSTOMER','DELIVERY_PARTNER','CUSTOMER_SUPPORT')));
CREATE TABLE permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(60) UNIQUE NOT NULL, description text);
CREATE TABLE role_permissions (role_id uuid REFERENCES roles,
  permission_id uuid REFERENCES permissions, PRIMARY KEY (role_id, permission_id));
CREATE TABLE user_roles (user_id uuid NOT NULL REFERENCES users,
  role_id uuid NOT NULL REFERENCES roles, city_id uuid REFERENCES cities,
  shop_id uuid REFERENCES shops, PRIMARY KEY (user_id, role_id,
  coalesce(city_id,'00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(shop_id,'00000000-0000-0000-0000-000000000000'::uuid)));
CREATE TABLE customer_profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users, default_address_id uuid,
  gender varchar(1), birth_date date, marketing_consent bool DEFAULT false);
CREATE TABLE addresses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users, label text, line1 text NOT NULL,
  line2 text, landmark text, locality_id uuid REFERENCES localities,
  pincode varchar(6) NOT NULL, latitude double precision, longitude double precision,
  is_default bool DEFAULT false);
```
**APIs:** `GET/PATCH /me` · `GET/POST/DELETE /me/addresses/{id}` · admin:
`GET /admin/users?role&after` · `POST /admin/users/{id}/block`.
**Rules:** one user may hold customer + seller roles; role changes always audited;
address geocoded on save (Maps API, `geocode_cache`); DPDP: consent at signup;
account deletion nulls PII, keeps anonymised financial rows.
**Events out:** `address.created.v1`. **Accept:** CITY_ADMIN cross-city denied;
geocode cached; delete purges PII.

## M03 — Geography & Serviceability
**Purpose:** geo master data + zones; serviceability/fee/ETA primitives for
search, checkout, delivery. **Build:** Phase 0 · Step 2. **Extract:** geo service.
**Tables:**
```sql
CREATE TABLE countries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code varchar(2) UNIQUE NOT NULL, name text NOT NULL, phone_code varchar(5));
CREATE TABLE states (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES countries, code varchar(10) NOT NULL,
  name text NOT NULL, is_active bool DEFAULT true, UNIQUE(country_id, code));
CREATE TABLE cities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id uuid NOT NULL REFERENCES states, name text NOT NULL, slug text NOT NULL UNIQUE,
  timezone text DEFAULT 'Asia/Kolkata', center geometry(Point,4326), is_active bool DEFAULT true);
CREATE TABLE localities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES cities, name text NOT NULL, slug text NOT NULL,
  boundary geometry(MultiPolygon,4326), UNIQUE(city_id, slug));
CREATE TABLE pincodes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES cities, pincode varchar(6) NOT NULL UNIQUE,
  boundary geometry(MultiPolygon,4326), is_serviceable bool DEFAULT true);
CREATE TABLE delivery_zones (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES cities, name text NOT NULL,
  zone_type varchar(13) CHECK (zone_type IN ('CIRCLE_RADIUS','POLYGON')) NOT NULL,
  center geometry(Point,4326), radius_m integer, boundary geometry(MultiPolygon,4326),
  fee_paise bigint NOT NULL, free_above_paise bigint,
  eta_min_minutes integer NOT NULL, eta_max_minutes integer NOT NULL, is_active bool DEFAULT true);
CREATE INDEX geo_cities_center ON cities USING gist(center);
CREATE INDEX geo_zones ON delivery_zones USING gist(COALESCE(boundary, center));
CREATE TABLE geocode_cache (cache_key text PRIMARY KEY, lat double precision,
  lng double precision, formatted text, fetched_at timestamptz DEFAULT now());
```
**APIs (public, 24 h cache):** `GET /geo/states` · `GET /geo/cities?stateId` ·
`GET /geo/localities?cityId` · `GET /geo/pincode/{pincode}` · `GET /geo/detect?lat&lng`.
**Serviceability (GeoPort):** pincode match **OR** `ST_Contains(zone.boundary, point)`
**OR** `ST_DWithin(shop, drop, radius)`; fee/ETA from most specific zone hit;
distance `ST_Distance`.
**Seed:** LGD states · India Post pincode CSV · **Bijnor localities verified on ground**.
**Accept:** polygon boundary cases; pincode fallback; fee slab math exact.
## M04 — Sellers & KYC · M05 — Shops · M06 — Shop Domains
**Purpose:** onboarding→live-shop pipeline (W1); the tenant aggregate; host→tenant.
**Build:** Phase 1 · Step 5. **Extract:** tenant-registry service (M05+M06).
**Tables:**
```sql
CREATE TABLE sellers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users, legal_name text NOT NULL,
  display_name text NOT NULL, business_type varchar(13) CHECK (business_type IN
  ('INDIVIDUAL','PROPRIETORSHIP','PARTNERSHIP','LLP','PVT_LTD')) NOT NULL,
  pan varchar(10) NOT NULL, gstin varchar(15),
  status varchar(12) DEFAULT 'DRAFT' CHECK (status IN
  ('DRAFT','KYC_PENDING','APPROVED','SUSPENDED','REJECTED')),
  kyc_submitted_at timestamptz, approved_at timestamptz, approved_by uuid REFERENCES users);
CREATE TABLE bank_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type varchar(15) CHECK (owner_type IN ('SELLER','DELIVERY_PARTNER')) NOT NULL,
  owner_id uuid NOT NULL, holder_name text NOT NULL, account_no_enc text NOT NULL,
  ifsc varchar(11) NOT NULL, verified bool DEFAULT false, is_primary bool DEFAULT true);
CREATE TABLE kyc_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers, doc_type varchar(20) NOT NULL,
  media_id uuid NOT NULL REFERENCES media, status varchar(10) DEFAULT 'PENDING'
  CHECK (status IN ('PENDING','VERIFIED','REJECTED')), verified_by uuid, note text);
CREATE TABLE shops (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- tenant root
  seller_id uuid NOT NULL REFERENCES sellers, city_id uuid NOT NULL REFERENCES cities,
  name text NOT NULL, slug text NOT NULL UNIQUE, logo_media_id uuid, banner_media_id uuid,
  description text, category_ids uuid[] DEFAULT '{}',
  status varchar(9) DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED')),
  rating_avg numeric(3,2) DEFAULT 0, rating_count integer DEFAULT 0,
  opened_at timestamptz, closed_at timestamptz);
CREATE TABLE shop_domains (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid UNIQUE NOT NULL REFERENCES shops, host text NOT NULL UNIQUE,
  host_type varchar(10) DEFAULT 'SUBDOMAIN', verified_at timestamptz,
  ssl_status varchar(8) DEFAULT 'PENDING' CHECK (ssl_status IN ('PENDING','ACTIVE','FAILED')));
CREATE TABLE shop_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid UNIQUE NOT NULL REFERENCES shops,
  delivery_mode varchar(9) DEFAULT 'BOTH' CHECK (delivery_mode IN ('SELF','PLATFORM','BOTH')),
  pickup_address_id uuid REFERENCES addresses, opening_hours jsonb,
  return_policy_text text, min_order_paise bigint DEFAULT 0,
  commission_rate_override numeric(5,2), locale varchar(2) DEFAULT 'EN', theme jsonb);
```
**APIs:** seller: `POST /sellers/register` · `PATCH /sellers/me` ·
`POST /sellers/kyc/documents` · `POST /sellers/me/submit-kyc` · `POST /shops` ·
`PATCH /shops/{id}`; admin: `GET /admin/sellers?kycStatus` ·
`POST /admin/sellers/{id}/approve|reject|suspend`; resolve:
`GET /internal/resolve-tenant?host=` (HMAC-signed, Redis 60 s) ·
`GET /storefront/resolve?host=`.
**KYC machine:** DRAFT → KYC_PENDING → APPROVED ⇄ SUSPENDED; REJECTED → resubmit → KYC_PENDING.
**Rules:** PAN regex+checksum; GSTIN checksum; docs in **private** bucket
(signed 10-min URLs); approval cascade: `shops.status=ACTIVE` + slug +
`shop_domains` + notify; suspend cascades listings → PAUSED; slug collision →
`-2` suffix (transactional).
**Events out:** `kyc.submitted/approved.v1`, `shop.created/updated/suspended.v1`.
**Screens:** onboarding wizard; admin KYC queue. **Extract:** tenant-registry.
**Accept:** slug race 1-winner; cascade complete; docs private; cache invalidation on rename.

## M07 — Catalog (categories, brands, master products, variants, matching)
**Purpose:** the shared product master so the same product can be offered by many
shops and compared like-for-like. **Build:** Phase 2 · Step 5–7. **Extract:** catalogue service.
**Tables:**
```sql
CREATE TABLE categories (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES categories, name text NOT NULL, slug text NOT NULL UNIQUE,
  path ltree NOT NULL,                       -- e.g. 'root.men.shirts'
  attribute_schema jsonb,                    -- [{"key":"size","type":"enum","values":[…],"required":true}]
  icon_media_id uuid, sort_order integer DEFAULT 0,
  is_active bool DEFAULT true, requires_approval bool DEFAULT false,
  return_window_days integer DEFAULT 7, is_non_returnable bool DEFAULT false);
CREATE TABLE brands (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL, slug text NOT NULL UNIQUE, logo_media_id uuid, is_active bool DEFAULT true);
CREATE TABLE products (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories, brand_id uuid REFERENCES brands,
  name text NOT NULL, slug text NOT NULL UNIQUE, description text,
  gtin varchar(14) UNIQUE, attributes jsonb,
  status varchar(15) DEFAULT 'DRAFT' CHECK (status IN
  ('DRAFT','PENDING_REVIEW','ACTIVE','INACTIVE')),
  match_group_id uuid, created_by uuid, category_schema_snapshot jsonb);
CREATE INDEX products_fts ON products USING gin(to_tsvector('simple', name || ' ' || coalesce(description,'')));
CREATE TABLE product_variants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products, sku text UNIQUE,
  attributes jsonb NOT NULL,                    -- {"size":"M","color":"Blue"}
  weight_grams integer, dimensions_mm jsonb, barcode varchar(20), is_active bool DEFAULT true);
CREATE TABLE product_media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products, variant_id uuid REFERENCES product_variants,
  shop_id uuid, media_id uuid NOT NULL REFERENCES media,
  sort_order integer DEFAULT 0, is_primary bool DEFAULT false);
CREATE TABLE match_groups (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status varchar(9) DEFAULT 'OPEN' CHECK (status IN ('OPEN','MERGED','DISMISSED')),
  canonical_product_id uuid REFERENCES products, similarity numeric(4,3), resolved_by uuid);
```
**APIs:** public: `GET /categories` (tree) · `GET /brands?q=` ·
`GET /products/{id}?variantId=` (master + media + variants + rating); admin:
category/brand CRUD, `GET /admin/match-queue`, `POST /admin/match-queue/{id}/merge|dismiss`;
seller (via M08 wizard): product search-or-create `GET /catalog/products/match?q&barcode`.
**Rules:** attribute values validated against `category_schema_snapshot`; GTIN
match → auto-attach listing to existing master; fuzzy (name+brand+category
trigram ≥ 0.75) → `match_groups` for admin merge (products still publishable
against best match); merging redirects all listings to canonical master.
**Events out:** `product.created.v1`, `product.merged.v1`.
**Accept:** GTIN dedupe; schema validation per category; merge redirects listings;
comparison only on same `(product_id, variant_id)`.

## M08 — Listings (a shop's offer)
**Purpose:** per-shop offer rows: price, MRP, SKU, tax, lifecycle. Publish once →
visible on shop site + marketplace + search + apps. **Build:** Phase 1 · Step 7.
**Tables:**
```sql
CREATE TABLE seller_listings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- ⛁ tenant
  shop_id uuid NOT NULL REFERENCES shops, product_id uuid NOT NULL REFERENCES products,
  title_override text,
  status varchar(13) DEFAULT 'DRAFT' CHECK (status IN
  ('DRAFT','PAUSED','ACTIVE','OUT_OF_STOCK','REJECTED')),
  listed_at timestamptz, deactivated_at timestamptz, UNIQUE(shop_id, product_id));
CREATE INDEX listings_shop_status ON seller_listings(shop_id, status);
CREATE INDEX listings_product ON seller_listings(product_id, status);
CREATE TABLE listing_variants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- ⛁ tenant
  listing_id uuid NOT NULL REFERENCES seller_listings,
  variant_id uuid NOT NULL REFERENCES product_variants,
  seller_sku text NOT NULL, mrp_paise bigint NOT NULL, price_paise bigint NOT NULL,
  tax_rate_bp integer NOT NULL DEFAULT 0, stock_tracked bool DEFAULT true, is_active bool DEFAULT true,
  CHECK (price_paise <= mrp_paise), UNIQUE(listing_id, variant_id), UNIQUE(shop_id, seller_sku));
CREATE TABLE price_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_variant_id uuid NOT NULL REFERENCES listing_variants,
  price_paise bigint NOT NULL, changed_by uuid, reason text);
```
**APIs (seller):** `POST /shops/{id}/listings/draft` · `PATCH /listings/{id}` ·
`PATCH /listings/{id}/variants/{vid}` (quick price/stock) ·
`POST /listings/{id}/publish|pause|resume` · `POST /listings/bulk-import` (CSV) ·
`GET /shops/{id}/listings?q&status&after`; public: `GET /products/{id}/offers?cityId&variantId`
(all shops' offers for the SAME variant, sorted price/distance/ETA/rating).
**Rules:** publish requires ≥1 image + required attributes + price + stock
(422 with per-field errors otherwise); every price change → `price_history`;
available=0 → auto `OUT_OF_STOCK` (+search delist); restore → `ACTIVE`.
**Events out:** `listing.published/updated/paused.v1` → search index + storefront revalidate.
**Screens:** product wizard (W2); inventory grid; bulk import UI.
**Accept:** publish validation matrix; price history; same-variant offers only;
bulk import 500 rows < 5 min with row-level errors.
## M09 — Inventory (stock truth)
**Purpose:** the single authority for stock; atomic reservations prevent overselling.
**Build:** Phase 2 · Step 8. **Extract:** inventory service (strong candidate).
**Tables:**
```sql
CREATE TABLE inventory_locations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- ⛁
  shop_id uuid NOT NULL REFERENCES shops, name text DEFAULT 'Shop Floor',
  address_id uuid REFERENCES addresses, is_default bool DEFAULT true, is_active bool DEFAULT true);
CREATE TABLE stock (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES inventory_locations,
  listing_variant_id uuid NOT NULL REFERENCES listing_variants,
  quantity_on_hand integer NOT NULL DEFAULT 0, quantity_reserved integer NOT NULL DEFAULT 0,
  reorder_level integer DEFAULT 5,
  CHECK (quantity_on_hand >= quantity_reserved), UNIQUE(location_id, listing_variant_id));
CREATE TABLE stock_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES stock, delta_on_hand integer NOT NULL,
  delta_reserved integer NOT NULL, reason varchar(15) NOT NULL CHECK (reason IN
  ('ORDER_RESERVE','ORDER_RELEASE','ORDER_SALE','RETURN','MANUAL_ADJUST','IMPORT','CORRECTION')),
  reference_type text, reference_id uuid, actor_user_id uuid);   -- append-only
CREATE TABLE stock_reservations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES stock, order_item_id uuid NOT NULL,
  quantity integer NOT NULL, status varchar(9) DEFAULT 'ACTIVE' CHECK
  (status IN ('ACTIVE','RELEASED','CONSUMED')), expires_at timestamptz NOT NULL);
```
**The ONLY stock mutation (atomic, prevents oversell):**
```sql
UPDATE stock SET quantity_reserved = quantity_reserved + $qty
WHERE id = $id AND (quantity_on_hand - quantity_reserved) >= $qty
RETURNING *;    -- 0 rows ⇒ insufficient ⇒ reject; Redis is NEVER the authority
```
**APIs (InventoryPort):** `reserve(items)`, `release(ids)`, `consume(ids)`,
`adjust(stockId, delta, reason)`, `availability(variantIds)`. Seller quick stock
edit goes through M08 → this port.
**Rules:** every mutation writes a `stock_movements` row in the same transaction;
reservation CONSUME on DISPATCH, RELEASE on cancel/reject/timeout (TTL 30 min via
`order-timers`); nightly reconciliation `stock` vs sum(movements) — drift alerts.
**Events out:** `stock.low.v1`, `stock.out.v1` (→ search delist), `stock.reconciled.v1`.
**Screens:** seller inventory grid (inline +qty/−qty, low-stock badge).
**Accept:** 100 parallel reservations on stock=10 → exactly 10 succeed; TTL
release restores availability; reconciliation zero-drift; RLS isolation passes.

## M10 — Media
**Purpose:** signed uploads, image derivatives, scanning, per-shop quota.
**Build:** Phase 1 · Step 6. **Extract:** asset-pipeline service.
**Table:**
```sql
CREATE TABLE media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users, shop_id uuid,
  kind varchar(14) NOT NULL CHECK (kind IN
  ('PRODUCT_IMAGE','LOGO','BANNER','POD','DOCUMENT','RETURN_PHOTO')),
  storage_key text NOT NULL, mime varchar(30) NOT NULL, width integer, height integer,
  size_bytes integer NOT NULL, variants jsonb,
  scan_status varchar(9) DEFAULT 'PENDING' CHECK (scan_status IN ('PENDING','CLEAN','REJECTED')));
```
**APIs:** `POST /media/upload-url {kind, mime, sizeBytes}` → `{uploadUrl, mediaId}`
(S3 presigned, 10-min TTL) → client PUTs → `POST /media/{id}/complete` → queue
process → `GET /media/{id}`. KYC/doc kinds go to the private bucket.
**Rules:** allowlist jpeg/png/webp; content-sniffing (MIME spoof rejected); ≤6
product images per listing, ≤5 MB; derivatives 256/512/1024 WebP via sharp
(<10 s); EXIF stripped; virus scan before `CLEAN`; quota per shop (default 2 GB).
**Events out:** `media.processed.v1`.
**Screens:** wizard step 1; PoD capture; KYC uploads.
**Accept:** spoof rejected; derivatives generated; private URLs expire; quota enforced.
## M11 — Search & Discovery
**Purpose:** city-scoped search with filters/sorts/suggestions. **Build:** Phase 3 · Step 10.
**Impl v1:** Postgres FTS + `pg_trgm` typo tolerance + PostGIS distance sort over
a projection of ACTIVE listings. OpenSearch later behind the same `SearchPort`.
**Table:** `search_synonyms(id uuid, term text, synonyms text[], locale)`.
**APIs:** `GET /search?q&cityId&category&brand&minPrice&maxPrice&size&color&shopId
&inStock&maxDistanceKm&maxEtaMinutes&minRating&sort&after` — sorts: `price_asc`,
`price_desc`, `nearest`, `fastest`, `rating`; `GET /search/suggest?q` (≤8).
**Result card:** name, image, price, MRP strike, shop + distance, stock badge,
ETA, rating, sponsored label. **Rules:** city + serviceable + ACTIVE only;
ranking = relevance × in-stock × rating; sponsored always labelled; zero results
→ suggestions + `search.miss` analytics event.
**Events in:** `listing.*`, `product.*`, `stock.out.v1`.
**Accept:** relevance golden set; "nkie shoes" finds Nike; p95 < 300 ms @ 50k listings.

## M12 — Cart
**Purpose:** multi-shop cart with drift surfacing. **Build:** Phase 3 · Step 11.
```sql
CREATE TABLE carts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users, city_id uuid NOT NULL REFERENCES cities,
  status varchar(8) DEFAULT 'OPEN' CHECK (status IN ('OPEN','ORDERED','ABANDONED')),
  coupon_code text);
CREATE UNIQUE INDEX one_open_cart ON carts(user_id) WHERE status='OPEN';
CREATE TABLE cart_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid NOT NULL REFERENCES carts, listing_variant_id uuid NOT NULL,
  listing_id uuid NOT NULL, shop_id uuid NOT NULL, quantity integer NOT NULL,
  added_price_paise bigint NOT NULL);   -- snapshot; revalidated on every read
```
**APIs:** `GET /cart` (revalidates; drift per item) · `POST /cart/items` ·
`PATCH /cart/items/{id}` · `DELETE /cart/items/{id}`.
**Rules:** ≤50 items, ≤10 shops; anonymous cookie-cart merges at login; quantity
capped at availability. **Accept:** anon merge; drift detection; caps enforced.

## M13 — Checkout (quote + place-order orchestration)
**Purpose:** compute quote; place order as ONE transaction across modules.
**Build:** Phase 3 · Step 11. **Prereq:** M03, M09, M12, M14, M15, M20.
**APIs:** `POST /checkout/quote {cartId, addressId, couponCode?}` →
```json
{"quoteId":"q_01J…","expiresAt":"…+10m",
 "shopGroups":[{"shopId":"…","shopName":"Bagga Cloth","itemsTotal":79900,
   "deliveryFee":4000,"etaMinutes":90}],
 "itemsTotal":79900,"deliveryTotal":4000,"discount":0,"taxIncluded":true,"grandTotal":83900}
```
`POST /checkout/payment-intent {quoteId, method}` → gateway order ref (or COD
token); `POST /orders {quoteId}` (`Idempotency-Key` required) — online: order
confirmed by capture webhook; COD: created immediately (risk-gated).
**Place-order transaction writes ALL of:** parent `orders` + `seller_orders` +
snapshotted `order_items` + atomic stock reservations + `order_events(PLACED)` +
outbox `order.placed.v1` + `payments` row. Insufficient stock → 422 with per-item
availability; **nothing** written. Quote expiry 10 min.
**COD gates:** first-time users > ₹2,000 must prepay; per-user COD limit; COD
failures block COD 30 days. **Accept:** 3-shop split totals; idempotent replay;
per-item 422; quote expiry.

## M14 — Orders (OMS + state machines)
**Purpose:** parent/child orders, validated transitions, full event history.
**Build:** Phase 3–4 · Steps 11–12. **Extract:** OMS service.
**Tables:**
```sql
CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE,                    -- APN-2026-000123
  user_id uuid NOT NULL REFERENCES users, city_id uuid NOT NULL REFERENCES cities,
  address_snapshot jsonb NOT NULL,                  -- line1..pincode,lat,lng
  items_total_paise bigint NOT NULL, delivery_total_paise bigint NOT NULL,
  discount_paise bigint DEFAULT 0, tax_total_paise bigint NOT NULL,
  grand_total_paise bigint NOT NULL, currency char(3) DEFAULT 'INR',
  status varchar(18) NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN
  ('PENDING_PAYMENT','PLACED','PARTIALLY_CANCELLED','COMPLETED','CANCELLED')),
  payment_id uuid, placed_at timestamptz, completed_at timestamptz,
  cancelled_at timestamptz, cancellation_reason text);
CREATE TABLE seller_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- ⛁ tenant
  order_id uuid NOT NULL REFERENCES orders, shop_id uuid NOT NULL REFERENCES shops,
  seller_order_no text NOT NULL, items_total_paise bigint NOT NULL,
  delivery_fee_paise bigint NOT NULL, tax_total_paise bigint NOT NULL,
  commission_paise bigint DEFAULT 0, seller_net_paise bigint DEFAULT 0,
  status varchar(17) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ACCEPTED','REJECTED',
  'PREPARING','READY','DISPATCHED','OUT_FOR_DELIVERY','DELIVERED','CLOSED','CANCELLED',
  'RETURN_REQUESTED','RETURNED')),
  accept_deadline_at timestamptz, accepted_at timestamptz, rejected_reason text,
  delivered_at timestamptz, closed_at timestamptz, UNIQUE(shop_id, seller_order_no));
CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES seller_orders,
  order_id uuid NOT NULL REFERENCES orders,
  listing_variant_id uuid, product_id uuid, variant_id uuid, quantity integer NOT NULL,
  unit_price_paise bigint NOT NULL, mrp_paise bigint, tax_rate_bp integer, tax_amount_paise bigint,
  line_total_paise bigint NOT NULL, name_snapshot text NOT NULL, sku_snapshot text NOT NULL,
  image_media_id uuid, weight_grams integer,
  status varchar(9) DEFAULT 'NORMAL' CHECK (status IN ('NORMAL','CANCELLED','RETURNED','EXCHANGED')));
CREATE TABLE order_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid, seller_order_id uuid, order_item_id uuid, event varchar(24) NOT NULL,
  from_status text, to_status text,
  actor_type varchar(8) NOT NULL CHECK (actor_type IN ('CUSTOMER','SELLER','RIDER','ADMIN','SYSTEM')),
  actor_id uuid, payload jsonb);   -- append-only
```
**State machines (authoritative):**
- **Parent:** PENDING_PAYMENT → PLACED → PARTIALLY_CANCELLED / CANCELLED /
  COMPLETED. COMPLETED only when ALL children CLOSED (delivered + return window
  elapsed + ledger posted).
- **Child:** NEW →(accept; 10-min deadline)→ ACCEPTED → PREPARING → READY →
  DISPATCHED → OUT_FOR_DELIVERY → DELIVERED → CLOSED. NEW→REJECTED (reason or
  timeout → refund child + release stock). Pre-dispatch cancel (customer/seller/
  admin) → refund. DELIVERED → RETURN_REQUESTED → RETURNED → CLOSED. Partial
  cancel: items CANCELLED + totals recomputed; parent → PARTIALLY_CANCELLED.
**APIs:** `GET /orders?after` · `GET /orders/{id}` (consolidated customer view
with per-child tracking) · `POST /orders/{id}/cancel` ·
`POST /seller-orders/{id}/accept|reject|preparing|ready` ·
`GET /shops/{id}/orders?status&after` · admin console.
**Rules:** every transition validated (role × from→to) else **409**; one
`order_events` row per transition; timers: accept 10 min, reservation TTL 30 min,
return window per category (7 d default). Customer free-cancel only while all
children ∈ {NEW, ACCEPTED}.
**Accept:** full legal/illegal matrix; timeout auto-reject + refund; partial
cancel math; history immune to listing edits (snapshots).
## M15 — Payments
**Purpose:** gateway abstraction, verified webhooks, refunds, COD.
**Build:** Phase 3 · Step 11. **Extract:** payments service.
**Tables:**
```sql
CREATE TABLE payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders,
  provider varchar(8) NOT NULL CHECK (provider IN ('CASHFREE','RAZORPAY','COD')),
  provider_order_ref text, amount_paise bigint NOT NULL, currency char(3) DEFAULT 'INR',
  method varchar(10) CHECK (method IN ('UPI','CARD','NETBANKING','WALLET','COD')),
  status varchar(16) NOT NULL DEFAULT 'CREATED' CHECK (status IN
  ('CREATED','AUTHORIZED','CAPTURED','FAILED','REFUNDED','PARTIALLY_REFUNDED')),
  captured_at timestamptz, idempotency_key text UNIQUE);
CREATE TABLE payment_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments, provider_txn_ref text,
  type varchar(7) CHECK (type IN ('CREATE','CAPTURE','REFUND','STATUS')),
  status text, amount_paise bigint, raw_payload jsonb, signature_verified bool);
CREATE TABLE refunds (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments, seller_order_id uuid, order_item_id uuid,
  amount_paise bigint NOT NULL, reason text,
  status varchar(10) DEFAULT 'REQUESTED' CHECK (status IN
  ('REQUESTED','APPROVED','INITIATED','COMPLETED','FAILED')),
  provider_ref text, initiated_by uuid, completed_at timestamptz);
CREATE TABLE webhook_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(20) NOT NULL, event_type text NOT NULL, external_ref text NOT NULL,
  signature_valid bool, raw_payload jsonb, processed_at timestamptz, processing_error text,
  UNIQUE(provider, event_type, external_ref));   -- replay guard
```
**APIs:** `POST /webhooks/payments/{provider}` — verify signature + timestamp
window + replay → emit `payment.captured.v1` (**webhook is the ONLY capture
authority**; manual edits forbidden); `POST /payments/{id}/refund` (support/admin
within limits; scoped to child order or item).
**Rules:** COD — CAPTURED on delivered + rider cash-confirm → `COD_HOLDING`
ledger → daily rider-cash reconciliation; refunds to original method or UPI (COD).
**Accept:** replayed webhook ignored; bad signature 400; partial refund math exact.

## M16 — Finance (double-entry ledger, commission, settlement) · M31 — Invoicing
**Purpose:** money truth. **Build:** Phase 5 · Step 15. **Extract:** finance service.
**Tables:**
```sql
CREATE TABLE ledger_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type varchar(16) NOT NULL CHECK (owner_type IN
  ('PLATFORM','SELLER','DELIVERY_PARTNER','CUSTOMER')),
  owner_id uuid NOT NULL, account_type varchar(14) NOT NULL CHECK (account_type IN
  ('RECEIVABLE','PAYABLE','COMMISSION_INCOME','DELIVERY_INCOME','GATEWAY_FEE',
  'TAX_COLLECTED','COD_HOLDING','REFUND_CLAIM')),
  balance_paise bigint DEFAULT 0, UNIQUE(owner_type, owner_id, account_type));
CREATE TABLE ledger_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,        -- groups both sides of a posting
  ledger_account_id uuid NOT NULL REFERENCES ledger_accounts,
  debit_paise bigint DEFAULT 0, credit_paise bigint DEFAULT 0,
  source_type text, source_id uuid, memo text, settlement_id uuid, created_by uuid);
-- DB trigger: SUM(debit)=SUM(credit) per transaction_id; UPDATE/DELETE revoked.
CREATE TABLE settlements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES sellers, period_start date, period_end date,
  gross_sales_paise bigint, commission_paise bigint, delivery_paise bigint,
  refunds_paise bigint, tcs_paise bigint, adjustments_paise bigint, net_paise bigint,
  status varchar(10) DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','PAID','FAILED')),
  provider_payout_ref text, utr text, paid_at timestamptz, statement_no text UNIQUE);
CREATE TABLE settlement_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid NOT NULL REFERENCES settlements, seller_order_id uuid NOT NULL,
  amount_paise bigint NOT NULL, breakdown jsonb);
CREATE TABLE commissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid REFERENCES cities, category_id uuid REFERENCES categories,
  shop_id uuid REFERENCES shops,             -- shop = seller override
  rate_bp integer NOT NULL, valid_from timestamptz, valid_to timestamptz);
-- M31: invoices(id, seller_order_id, series, seq_no, irn, pdf_media_id, …),
--      credit_notes(id, refund_id, …) — GST series per seller, e-invoice IRN hooks.
```
**Posting example (₹1,000 item, 5% commission, ₹50 delivery, 2% gateway fee):**
T-1001 DR CustomerReceivable 105,000 / CR SellerPayable 100,000 + CR DeliveryIncome
5,000 · T-1002 DR CommissionIncome 5,000 / CR SellerPayable 5,000 · T-1003 DR
GatewayFee 2,000 / CR Clearing 2,000 → seller payable **₹950**; T-1004 settlement
payout DR SellerPayable 95,000 / CR Bank 95,000 (+UTR); refund clawback T-1005
reverses item + commission.
**Settlement:** nightly job batches CLOSED children → T+2 payout via gateway
split after **two-person approval** → statement PDF (order-wise commission).
TCS lines per CA config. Daily reconciliation: ledger vs gateway report — any
diff alerts immediately.
**APIs:** `GET /shops/{id}/payments` · `GET /shops/{id}/settlements` ·
`GET /admin/settlements` · `POST /admin/settlements/{id}/release` (2-person).
**Accept:** worked example reproduces exactly; ledger == gateway report to the
paise over a simulated week incl. refunds + COD; two-person rule enforced.
## M17 — Delivery Engine · M18 — Delivery Partners
**Purpose:** jobs, scoring-based rider assignment, OTP/PoD, tracking, reverse
logistics; rider onboarding/availability/earnings. **Build:** Phase 4 · Step 13.
**Extract:** logistics service (LogisticsPort already fits 3PL swap later).
**Tables:**
```sql
CREATE TABLE delivery_partners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES users, city_id uuid NOT NULL REFERENCES cities,
  vehicle varchar(8) CHECK (vehicle IN ('BIKE','SCOOTER','BICYCLE','TEMPO','WALK')),
  kyc_status varchar(9) DEFAULT 'PENDING' CHECK (kyc_status IN ('PENDING','APPROVED','REJECTED')),
  bank_account_id uuid, is_available bool DEFAULT false,
  last_location geometry(Point,4326), last_seen_at timestamptz, current_job_id uuid,
  rating_avg numeric(3,2) DEFAULT 5, rating_count integer DEFAULT 0);
CREATE TABLE delivery_partner_zones (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_partner_id uuid NOT NULL REFERENCES delivery_partners, locality_id uuid NOT NULL);
CREATE TABLE delivery_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES seller_orders,
  type varchar(13) NOT NULL DEFAULT 'FORWARD' CHECK (type IN ('FORWARD','RETURN_PICKUP')),
  mode varchar(14) NOT NULL CHECK (mode IN ('PLATFORM_RIDER','SELLER_SELF')),
  status varchar(18) NOT NULL DEFAULT 'UNASSIGNED' CHECK (status IN ('UNASSIGNED','ASSIGNED',
  'ACCEPTED','RIDER_REJECTED','AT_PICKUP','PICKED_UP','IN_TRANSIT','AT_DROP','DELIVERED',
  'FAILED','RETURNED_TO_SELLER','CANCELLED')),
  delivery_partner_id uuid REFERENCES delivery_partners,
  pickup_location geometry(Point,4326) NOT NULL, drop_location geometry(Point,4326) NOT NULL,
  distance_m integer, fee_paise bigint, eta_minutes integer, otp_hash text,
  assignment_reason jsonb, assigned_at timestamptz, expires_at timestamptz,
  picked_up_at timestamptz, delivered_at timestamptz, failed_reason text);
CREATE TABLE tracking_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_job_id uuid NOT NULL REFERENCES delivery_jobs, delivery_partner_id uuid,
  event varchar(14) NOT NULL CHECK (event IN ('ASSIGNED','ACCEPTED','REJECTED','AT_PICKUP',
  'PICKED_UP','IN_TRANSIT_PING','AT_DROP','OTP_VERIFIED','POD_UPLOADED','DELIVERED','FAILED')),
  location geometry(Point,4326), payload jsonb);   -- rider GPS pings throttled 15 s
CREATE TABLE proof_of_delivery (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_job_id uuid NOT NULL REFERENCES delivery_jobs, media_id uuid,
  otp_verified bool, signature_media_id uuid, signed_by_name text, delivered_to_relation text);
```
**Assignment (on child READY):** candidates = available, same city, ≤3 km from
pickup, vehicle fits weight, ≤2 active jobs; **score = 0.4×(1/distance_km) +
0.3×(1/(1+active_jobs)) + 0.2×rating + 0.1×vehicle_fit**; best score gets a
60-s offer → timeout/reject → next candidate. `assignment_reason` stored (auditable).
**Delivery OTP:** 4-digit, hash-stored, in customer app + SMS at DISPATCHED;
rider enters → verified → DELIVERED + PoD (photo and/or signature + signed_by).
3 wrong → support ticket + call prompt. **Failed:** reason required; retry ×2
(10-min cooldown) → `RETURNED_TO_SELLER` reverse job; refund per policy.
**SELLER_SELF:** same tables/statuses, driven from seller portal.
**APIs (rider):** `GET /delivery/jobs?status=AVAILABLE|ASSIGNED` ·
`POST /delivery/jobs/{id}/accept|reject` · `POST /delivery/jobs/{id}/status`
(picked_up/in_transit/at_drop/delivered/failed) · `POST /delivery/jobs/{id}/otp-verify`
· `POST /delivery/jobs/{id}/pod` · `POST /delivery/partners/me/location` (batch) ·
`GET /delivery/partners/me/earnings`; customer: `GET /orders/{id}/tracking` (live).
**Rider rules:** offline > 5 min → auto-unavailable; earnings = job fees +
incentives, weekly payout via ledger; app **offline queue** (local persistence,
idempotent sync on reconnect).
**Accept:** scoring order correct; 60-s timeout → next rider; OTP path; failed ×2
→ reverse job; seller-self works; airplane-mode sync test passes.
## M19 — Returns
**Purpose:** return/exchange requests, policy windows, inspection, refund trigger.
**Build:** Phase 4 · Step 14.
```sql
CREATE TABLE return_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES seller_orders,
  order_item_id uuid NOT NULL REFERENCES order_items, user_id uuid NOT NULL REFERENCES users,
  reason varchar(15) NOT NULL CHECK (reason IN ('DAMAGED','WRONG_ITEM','NOT_AS_DESCRIBED',
  'SIZE_ISSUE','CHANGED_MIND','LATE_DELIVERY','OTHER')),
  comments text, media_ids uuid[] DEFAULT '{}',
  status varchar(17) DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','REJECTED',
  'PICKUP_SCHEDULED','PICKED_UP','RECEIVED','INSPECTION_PASSED','INSPECTION_FAILED',
  'REFUND_INITIATED','COMPLETED','CANCELLED')),
  refund_method varchar(6) CHECK (refund_method IN ('ORIGINAL','UPI')), upi_id text,
  requested_at timestamptz, window_expires_at timestamptz, refund_id uuid, resolution_note text);
```
**Flow:** request (reason + photos) → window check (7 d default; per-category
override; non-returnables) → auto-approve ≤ ₹500 with reason ∈ {SIZE_ISSUE,
CHANGED_MIND} and no abuse history (>3 returns/10 orders → manual) → reverse
pickup job (M17) → RECEIVED → inspection pass/fail (seller, photos) → pass →
refund (M15, item-scoped) → notify; fail → dispute ticket (M23), refund frozen,
admin resolves. Restock via `stock_movements(RETURN)`.
**APIs:** `POST /orders/{id}/returns` · `GET /me/returns` ·
`POST /returns/{id}/inspect {pass, note, photos}` (seller) · admin resolve.
**Events out:** `return.approved.v1` → M17 job + M16 refund posting.
**Accept:** window expiry blocks; auto-approve gate; frozen refund on dispute;
restock recorded.

## M20 — Promotions
**Purpose:** coupons platform/city/shop scoped. **Build:** Phase 3; campaigns Phase 7.
```sql
CREATE TABLE coupons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope varchar(8) NOT NULL CHECK (scope IN ('PLATFORM','CITY','SHOP')),
  city_id uuid REFERENCES cities, shop_id uuid REFERENCES shops, code text NOT NULL,
  type varchar(13) NOT NULL CHECK (type IN ('PERCENT','FLAT','FREE_DELIVERY')),
  value_bp integer, value_paise bigint, min_order_paise bigint DEFAULT 0,
  max_discount_paise bigint, usage_limit integer, per_user_limit integer DEFAULT 1,
  valid_from timestamptz, valid_to timestamptz, is_active bool DEFAULT true);
CREATE TABLE coupon_redemptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons, user_id uuid NOT NULL,
  order_id uuid NOT NULL, discount_paise bigint NOT NULL);
```
**Rules:** validation stack scope→window→min-order→limits; no stacking;
FREE_DELIVERY applies to one shop group; discount capped at item level.
**Accept:** scope/limit tests; no stacking.
## M21 — Reviews
**Purpose:** verified-purchase reviews + exact aggregates. **Build:** Phase 4.
```sql
CREATE TABLE reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users, seller_order_id uuid NOT NULL,
  order_item_id uuid NOT NULL UNIQUE, product_id uuid NOT NULL, shop_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5), title text, body text,
  media_ids uuid[] DEFAULT '{}',
  status varchar(9) DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  moderation_reason text);
```
**Rules:** one review per `order_item` (verified purchase only); edit window
7 days; profanity filter + moderation queue; on approve → recompute
`products.rating_avg` / `shops.rating_avg` exactly (not incremental).
**APIs:** `POST /orders/{id}/reviews` · `GET /products/{id}/reviews` ·
`GET /shops/{slug}/reviews` · admin moderation queue.
**Accept:** unverified submit rejected; aggregate recompute exact.
## M22 — Notifications
**Purpose:** one gateway for SMS (DLT), WhatsApp, push, email; templates, prefs,
fail-closed compliance. **Build:** Phase 4 · Step 14. **Extract:** notification service.
**Tables:**
```sql
CREATE TABLE notification_templates (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,                       -- e.g. ORDER_NEW_SELLER
  channel varchar(8) NOT NULL CHECK (channel IN ('SMS','WHATSAPP','PUSH','EMAIL','INAPP')),
  locale varchar(2) DEFAULT 'EN' CHECK (locale IN ('EN','HI')),
  body_template text NOT NULL, dlt_template_id text,     -- MANDATORY for SMS rows
  whatsapp_template_name text, variables jsonb, is_active bool DEFAULT true);
CREATE TABLE notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL, template_code text NOT NULL, channel varchar(8) NOT NULL,
  payload jsonb, status varchar(10) DEFAULT 'QUEUED' CHECK (status IN
  ('QUEUED','SENT','FAILED','SUPPRESSED')), sent_at timestamptz, error text);
CREATE TABLE notification_preferences (user_id uuid NOT NULL, channel varchar(8) NOT NULL,
  topic varchar(8) NOT NULL CHECK (topic IN ('ORDERS','PROMOS','ACCOUNT')),
  opted_in bool NOT NULL, PRIMARY KEY (user_id, channel, topic));
```
**Template catalogue (register on DLT before launch):** OTP_LOGIN ·
WELCOME_CUSTOMER · SELLER_KYC_APPROVED · ORDER_PLACED_CUSTOMER ·
**ORDER_NEW_SELLER** · ORDER_ACCEPTED/REJECTED_CUSTOMER ·
ORDER_OUT_FOR_DELIVERY · DELIVERY_OTP · ORDER_DELIVERED_CUSTOMER ·
ORDER_RETURN_APPROVED · REFUND_COMPLETED · STOCK_LOW_SELLER ·
SETTLEMENT_PAID_SELLER · RIDER_NEW_JOB · PASSWORD_RESET · ORDER_CANCELLED_*.
Hindi + English variants for every template.
**Rules:** SMS with empty `dlt_template_id` **fails closed** (never sent);
critical order events fall back push→SMS; promo quiet hours 21:00–08:00 IST;
ORDERS topic always on; every send recorded with status/error.
**APIs:** template CRUD (admin) · `GET /me/notifications` · preference toggles.
**Accept:** fail-closed test; seller order alert < 5 s p95; opt-out suppression.

## M23 — Support & Disputes
**Purpose:** tickets, order disputes, SLA, resolution. **Build:** Phase 4 · Step 14.
```sql
CREATE TABLE support_tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_no text NOT NULL UNIQUE, opened_by_user_id uuid NOT NULL,
  type varchar(17) NOT NULL CHECK (type IN ('CUSTOMER_COMPLAINT','SELLER_ISSUE',
  'REFUND_ESCALATION','RETURN_DISPUTE','DELIVERY_ISSUE','OTHER')),
  order_id uuid, seller_order_id uuid, subject text NOT NULL, description text,
  priority varchar(7) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  status varchar(18) DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS',
  'AWAITING_CUSTOMER','RESOLVED','CLOSED','ESCALATED')),
  assigned_to uuid, sla_due_at timestamptz, resolved_at timestamptz);
CREATE TABLE ticket_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets,
  sender_type varchar(8) CHECK (sender_type IN ('CUSTOMER','SELLER','AGENT','SYSTEM')),
  sender_id uuid, body text, media_ids uuid[] DEFAULT '{}');
```
**Rules:** SLA by priority URGENT 2 h / HIGH 8 h / MEDIUM 24 h / LOW 48 h
(timer escalates); open dispute **freezes** auto-refund flows; full order
context (events timeline) auto-attached; support can refund within limit,
above limit → admin approval.
**APIs:** `POST /me/tickets` · `GET /me/tickets` · messages ·
agent queue/claim/reply/resolve (role CUSTOMER_SUPPORT).
**Accept:** SLA escalation fires; dispute freeze enforced.

## M24 — Admin Ops · M25 — Analytics · M28 — Webhooks · M32 — Content
**M24 (build Phase 1→16):** approval queues (KYC/shops/riders 24 h SLA), product
merge queue, order/dispute console, refunds, COD recon, settlement 2-person
release, config (taxonomy/commissions/zones/coupons/flags), audit search.
Every action → `audit_logs` with before/after + reason. APIs under `/admin/*`
(see M04/M08/M16 sections).
**M25 (Phase 5 · Step 16):** `analytics_events` (partitioned monthly:
search, product_view, add_to_cart, checkout_start, order_placed, delivery_times…)
+ hourly/daily rollups; dashboards: seller (own shop only — tenant-tested), city
admin (city), platform; no raw PII in dashboards; CSV export.
**M28 (Phase 3 inbound / Phase 5 outbound):** inbound = M15 webhook verification
+ storage; outbound = seller/system subscriptions to events
(`order.child.accepted`, `settlement.paid`) with HMAC-signed payloads, retries
1m/5m/30m/2h/6h, management API `GET/POST/DELETE /webhooks/subscriptions`.
**M32 (Phase 7 · Step 18):** CMS for city landing pages, banners, FAQ/help
centre — `pages/banners/faqs` tables + admin CRUD + public read APIs.
**Accept (all):** admin actions audited; seller dashboard isolation; rollups
correct; outbound retries work; CMS pages render on city site.
---

## M26 — Audit (Foundation)
**Purpose:** immutable record of every privileged action.
**Build:** Phase 0 · Step 4. **Tables:**
```sql
CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid, actor_role varchar(20), action text NOT NULL,
  entity_type text NOT NULL, entity_id uuid NOT NULL, shop_id uuid,
  before jsonb, after jsonb, ip inet, user_agent text, reason text);
REVOKE UPDATE, DELETE ON audit_logs FROM app_role;  -- append-only
```
**APIs:** `AuditPort.record(...)`; admin query `GET /admin/audit-logs?entityType&actor&after`.
**Rules:** every privileged mutation calls record() in the same transaction;
destructive ops require `reason`.
**Acceptance:** privileged action without audit fails a test; UPDATE/DELETE rejected.

## M27 — Outbox (Foundation)
**Purpose:** reliable event bus — business row + event written in ONE DB
transaction, dispatched async so no notification/integration is ever lost.
**Build:** Phase 0 · Step 1–2 · first module ever built. **Extract:** event-bus service (top candidate).
**Tables:**
```sql
CREATE TABLE outbox_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL, aggregate_id uuid NOT NULL,
  event_type text NOT NULL,            -- e.g. 'order.placed.v1'
  payload jsonb NOT NULL, status varchar(9) DEFAULT 'PENDING'
  CHECK (status IN ('PENDING','DISPATCHED','FAILED','DEAD')),
  attempts integer DEFAULT 0, next_attempt_at timestamptz DEFAULT now(),
  dispatched_at timestamptz);
CREATE INDEX outbox_pending ON outbox_events(status, next_attempt_at);
```
**APIs:** internal only — `OutboxPort.publish(aggregateType, aggregateId, eventType, payload)`
(inside caller's transaction). Worker: poll 1 s, dispatch to subscriber handlers,
backoff 1m→5m→30m→2h→6h → DEAD + alert. Consumers dedupe on `event_id`.
**Rules:** publish is ALWAYS in the same transaction as the business write;
payloads versioned & typed in `packages/events`.
**Acceptance:** ① business write + event atomic (kill worker → no loss);
② duplicate delivery ignored by consumer; ③ DEAD lands in DLQ + alert fires.

## M29 — Feature Flags (Foundation)
**Purpose:** kill switches + gradual rollout. **Build:** Phase 0 · Step 4.
**Tables:** `feature_flags(key text PRIMARY KEY, description text, default_enabled bool, rules jsonb, updated_by uuid)`.
**APIs:** `GET /flags/eval?keys=` (30 s cache, auth-optional, context = user/city/shop);
admin CRUD. **Rules:** DB unreachable → fall back to `default_enabled`.
**Acceptance:** flag flip visible ≤ 30 s; safe fallback proven.

## M30 — Idempotency (Foundation)
**Purpose:** safe retries for all mutating POSTs.
**Build:** Phase 0 · Step 4. **Tables:**
```sql
CREATE TABLE idempotency_keys (key text PRIMARY KEY, user_id uuid NOT NULL,
  endpoint text NOT NULL, request_hash text NOT NULL,
  response_status integer, response_body jsonb, expires_at timestamptz NOT NULL);
```
**APIs:** NestJS interceptor on mutating POSTs: header `Idempotency-Key` (UUID) →
same key + same request hash → return stored response; same key + different
request → 409. TTL 24 h.
**Acceptance:** replayed place-order returns the original order, creates nothing new.

# PART III — MASTER BUILD SEQUENCE

> Steps 0–18 in strict order. Each step: **Modules → Tasks → Verify gate**.
> Never start a step while the previous gate is red. One step = one or more PRs.

| Step | Modules | Phase / Sprint | Verify gate (must pass) |
|------|---------|----------------|--------------------------|
| **0 Prerequisites** | — (business) | Week 1 | entity registered · DNS + wildcard TLS · gateway sandbox keys · **DLT sender + templates approved (longest lead time — start first)** · WhatsApp API · Maps key · CA engaged |
| **1 Scaffold** | — | P0 / S0 | `pnpm turbo build` green; Docker Compose (postgis/redis/minio/mailpit) healthy; strict TS+ESLint; `.env.example` Zod-validated |
| **2 Database** | M03 tables | P0 / S0 | migrations + seed run; RLS check: app role without tenant sees 0 rows; Bijnor geo seeded |
| **3 CI** | — | P0 / S0 | PR checks (lint/typecheck/unit/integration) run; broken lint fails PR |
| **4 Auth+RBAC+Tenancy** | M27 M26 M30 M29 M01 M02 | P0 / S1 | OTP flow; lockout; refresh reuse → family revoke; `Host: bagga-cloth…` resolves tenant; unknown host 404; role guard 403s |
| **5 Seller+Shop+Domains** | M04 M05 M06 (+M24 queues) | P1 / S2–S3 | full onboarding journey on staging; slug race 1-winner; KYC docs private |
| **6 Media pipeline** | M10 | P1 / S3 | signed upload → WebP 256/512/1024 <10 s; MIME spoof rejected; quotas |
| **7 Product wizard+Listings+Import** | M07 M08 | P1 / S4 | publish validation matrix; 500-row CSV <5 min; **3 real shopkeepers × 10 products <15 min unaided (Hindi UI)** |
| **8 Inventory engine** | M09 | P2 / S6 | **100 parallel reservations on stock=10 → exactly 10 succeed**; TTL release; nightly reconciliation zero-drift |
| **9 Storefront+Marketplace+PDP** | (web app) | P2 / S7 | `{slug}.apnacity.com` branded; PDP offers from ≥3 shops same variant; sitemap/robots/JSON-LD valid |
| **10 Search** | M11 | P3 / S8 | relevance golden set; typo "nkie shoes"; p95 <300 ms @50k listings |
| **11 Cart+Checkout+Payments** | M12 M13 M15 M20 (+M14 create) | P3 / S9 | 3-shop cart → quote → sandbox pay → webhook → parent+3 children PLACED; **replayed webhook ignored**; idempotent replay; per-item 422 on stock drift |
| **12 OMS+Timers** | M14 | P4 / S10 | every legal/illegal transition tested; 10-min auto-reject+refund; partial-cancel math |
| **13 Delivery+Riders** | M17 M18 | P4 / S11 | scoring order; 60-s offer timeout; OTP path; failed ×2 → reverse job; seller-self mode |
| **14 Notifications+Returns+Support** | M22 M19 M23 | P4 / S12 | seller alert <5 s p95; SMS without DLT id fails closed; return window; dispute freeze |
| **15 Ledger+Settlement+Invoicing** | M16 M31 | P5 / S13–S14 | worked example reproduces exactly; **ledger == gateway report to the paisa** (simulated week incl. refunds+COD); 2-person payout |
| **16 Admin+Analytics** | M24 M25 | P5 / S15 | approval queues; ops console with full timeline; commission change audited; seller sees only own data |
| **17 Mobile apps** | customer/seller/rider (Expo) | P6 / S16–S18 | scripted journeys on real devices ×3 apps; airplane-mode rider sync; UPI intent; TestFlight/Play internal |
| **18 Hardening+Pilot** | M32 + swap SearchPort→OpenSearch (only if load test justifies) | P7 / S19–S20 | k6 targets met; pen-test fixed; DR drill ≤1 h; **Bijnor pilot checklist signed; first 10 real orders settle correctly** |

## Module dependency graph (safe order for "Build M<NN>" requests)

```
M27 outbox ─┬─ M26 audit ─ M01 auth ─ M02 users ─ M04 sellers ─ M05 shops ─ M06 domains
            ├─ M30 idem ─ M15 payments ─ M16 finance ─ M31 invoicing
            └─ M03 geo ─ M10 media ─ M07 catalog ─ M08 listings ─ M09 inventory
M08+M09 ─ M11 search ─ M12 cart ─ M14 orders ─ M13 checkout(+M15,M20) ─ M20 promos
M14 ─ M17 delivery(M18 riders) ─ M19 returns ─ M22 notify ─ M23 support
Parallel: M24 admin · M25 analytics · M28 webhooks · M29 flags · M32 content
```

**Safe request order:** M27 → M26 → M30 → M29 → M01 → M02 → M03 → M10 → M04 →
M05 → M06 → M07 → M08 → M09 → M11 → M12 → M15 → M14 → M13 → M20 → M17 → M18 →
M19 → M22 → M23 → M24 → M16 → M31 → M25 → M28 → M32.

## Team & timeline (2-week sprints)

Team: 1 tech lead · 2 full-stack · 1 mobile (from P6) · 1 QA · 0.5 designer.
Milestones: foundations W2 · seller publishing W8 · storefront+marketplace W14 ·
**MVP purchase flow W18** · delivery+returns W24 · money end-to-end W30 ·
mobile W36 · **Bijnor pilot W40** (incl. buffer).

## Definition of Done (every PR)

Tests green (incl. tenant-isolation suite) · Swagger + generated client updated ·
schema changes reflected in this guide's module section in the same PR · audit
events for privileged actions · feature-flagged if risky · runbook entry for new
jobs/endpoints · demo-able. **No fake APIs / placeholders / hardcoded data.**
---

# PART IV — FRONTEND APPS & SCREEN INVENTORY

## Web — `apps/web` (marketplace + city + shop storefront, ONE Next.js build)

**Marketplace screens (`apnacity.com`):** ① city selection (GPS/pincode/state→city)
② home (search, categories, featured shops, popular, offers, recently viewed)
③ category browse ④ search results (filters sidebar: price/brand/size/color/shop/
availability/distance/rating; sort bar) ⑤ product page (gallery, variants
selector, **offers table across shops for selected variant**, shop cards with
distance/ETA/rating) ⑥ shop profile ⑦ cart (grouped by shop, per-shop fee,
drift warnings) ⑧ checkout (address picker, delivery options, coupon, payment
methods, COD option) ⑨ order confirmation ⑩ orders list + order detail
(per-child status + live tracking map) ⑪ return request flow ⑫ reviews ⑬
account, addresses, wishlist ⑭ auth (OTP).
**City site (`bijnor.apnacity.com`):** hero, featured local shops, city offers,
SEO landing content (CMS M32).
**Shop storefront (`{slug}.apnacity.com`, tenant-resolved):** branded chrome
(logo/banner/theme from `shop_settings`), shop catalogue + shop search, product
pages, about/policies/hours/contact, per-tenant SEO (title/meta/canonical/
sitemap/robots/JSON-LD Store+Product+Offer). SSR/ISR with revalidate-on-publish.

## Seller portal — `apps/seller-portal` (PWA: installable, offline shell, push)

① onboarding wizard (W1, 6 steps) ② dashboard (today: orders, revenue, stock
alerts, ratings) ③ **product wizard (W2, 5 steps + camera capture + AI assist
flagged)** ④ my products (list, pause/resume, duplicate) ⑤ inventory grid
(inline qty/price quick edit, low-stock badges) ⑥ bulk import (mapping, progress,
row errors download) ⑦ orders inbox (sound + push on new; accept/reject one tap;
preparing/ready) ⑧ my shop (branding, hours, policies) ⑨ shop website preview
(link + QR code poster) ⑩ delivery settings (mode, fees) ⑪ payments (earnings,
per-order commission breakdown, settlements + PDF statements) ⑫ offers/coupons
⑬ reviews (reply, report) ⑭ reports (sales, products) ⑮ settings (GST, bank,
staff users, language EN/HI). **Hindi-first UX is a hard requirement.**

## Admin portal — `apps/admin-portal`

① KYC/seller approval queue (24 h SLA badge) ② shops list/suspend ③ product
merge queue ④ orders/disputes console (full `order_events` timeline, refund
actions, cancellations) ⑤ returns inspection disputes ⑥ settlements (batch
detail, **two-person release**) ⑦ COD reconciliation ⑧ config: geography,
taxonomy + attribute schemas, brands, commissions, delivery zones/fees, coupons,
feature flags, DLT template registry ⑨ analytics dashboards (city/platform) ⑩
audit log search ⑪ support ticket queue ⑫ CMS (city pages/banners/FAQ).

## Mobile — Expo (`apps/mobile`: customer · seller · rider)

**Customer app:** onboarding/city pick, home, search (cached lists), PDP with
offers, cart, checkout (**UPI intent deep link**), order tracking (live map +
OTP view), returns, reviews, wishlist, profile/addresses, push, deep links
(`apnacity://order/123` + universal links). Hindi/English toggle.
**Seller app:** order alerts (sound+push), accept/reject, mark preparing/ready,
camera product upload (reuse wizard API), quick stock edit, earnings summary.
**Rider app:** availability toggle, job queue with 60-s accept timer, navigation
deep link, OTP entry, PoD photo, **offline queue (local persistence + idempotent
reconnect sync)**, GPS ping (15 s active job), earnings + history.

## Shared packages

`ui` (design system incl. Hindi fonts) · `api-client` (generated from OpenAPI —
one contract for all six UIs) · `validation` (Zod: listing, checkout, address…) ·
`db` (Prisma schema/migrations/seed) · `events` (typed event contracts) ·
`config` (Zod env + money helpers — paise formatting).
---

# PART V — QUALITY, DEPLOYMENT, OPERATIONS & COMPLIANCE

## V1. Testing strategy (CI-enforced)

| Layer | Tool | Scope |
|-------|------|-------|
| Unit | Jest/Vitest | every service: rules, state machines, fee math, commission math |
| Integration | Jest + test DB (per-PR ephemeral) | module repositories, transactions, outbox atomicity |
| **Tenant isolation** | dedicated suite | attempts cross-tenant read/write on EVERY tenant table — must all fail |
| Concurrency | harness | 100-parallel reservations; slug race; payment replay |
| API contract | generated OpenAPI diff | PR fails if spec changes without regenerating client |
| E2E | Playwright | golden journeys: onboard→publish→search→buy→accept→deliver→return→settle |
| Mobile | Detox/maestro + manual | scripted journeys; airplane-mode rider sync |
| Load | k6 (Phase 7) | 200 rps browse / 50 rps search / 20 orders/min × 30 min |
| Security | pen test (Phase 7) | auth, IDOR on all /seller/* & /admin/*, webhook sigs, uploads |

## V2. CI/CD (GitHub Actions → Kubernetes, D-016)

PR: lint → typecheck → unit → integration (compose db/redis/minio) →
api-client regen check → tenant-isolation suite.
`main`: build app images (apps/*/Dockerfile, repo-root context) → push to
container registry (GHCR) → deploy to **staging namespace on the k8s
build/test server** (`kubectl apply` with pinned image digests; migration
Job runs `prisma migrate deploy` before rollout) → smoke (`/v1/health`,
storefront 200, tenant resolve) → Playwright e2e.
Tag `v*`: manual approval → migrate-prod Job → deploy production namespace →
smoke → notify. Rollback: redeploy previous image digest (migrations always
forward-compatible for one release). Mobile: EAS build on tag → staged rollout
10→50→100 % with crash-rate gate.

## V3. Environments & configuration

local (Docker Compose: `postgis/postgis:16-3.4`, `redis:7`, `minio`, `mailpit`) ·
**staging = `staging` namespace on the Kubernetes build/test server (D-016;
deploy on main, anonymised data, full e2e)** · production = `apnacity` namespace
(tag + approval). In-cluster Postgres+Redis on the server initially (PostGIS
image + PVC); managed DB when scale demands. Env injected via k8s
Secret (`apnacity-env`) / ConfigMap — never baked into images; TLS via
cert-manager wildcard (D-009).
`.env.example` keys: `DATABASE_URL DB_POOL_MAX REDIS_URL S3_ENDPOINT S3_REGION
S3_BUCKET_PUBLIC S3_BUCKET_PRIVATE S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY CDN_BASE_URL
JWT_ACCESS_SECRET JWT_ACCESS_TTL REFRESH_SECRET OTP_HASH_PEPPER
TENANT_RESOLVE_HMAC_SECRET PAYMENT_PROVIDER CASHFREE_APP_ID CASHFREE_SECRET_KEY
CASHFREE_WEBHOOK_SECRET DLT_SMS_PROVIDER DLT_SENDER_ID DLT_API_KEY WHATSAPP_TOKEN
WHATSAPP_PHONE_ID FCM_SERVER_KEY APNS_KEY_ID APNS_KEY EMAIL_FROM SMTP_URL
GEO_PROVIDER GOOGLE_MAPS_KEY SENTRY_DSN OTEL_EXPORTER_OTLP_ENDPOINT
FEATURE_FLAG_DEFAULTS`. Zod-validated at boot — missing/invalid → refuse to start.

## V4. Observability & alerting

OpenTelemetry traces (HTTP/Prisma/BullMQ/Redis) with traceId in every log + error
envelope; Grafana RED metrics + queue depth/DLQ + outbox lag + **ledger
imbalance** + business metrics; pino JSON logs (30 d hot / 1 y cold); Sentry
(web+mobile, release-tagged). **Page immediately:** 5xx >1 %, outbox DLQ >0,
ledger imbalance, webhook failure spike, reservation leaks, disk >80 %, cert <14 d.

## V5. Performance targets & backup/DR

Search p95 <300 ms · PDP TTFB <500 ms (LCP <2.5 s 4G) · place-order <800 ms ·
seller alert <5 s · rider assignment <10 s · 2,000 concurrent users · 50k
listings. Backups: Postgres PITR RPO 15 min + nightly cross-region dump (30 d) ·
S3 versioning + replication · Redis AOF (rebuildable) · **DR drill quarterly,
RTO ≤ 1 h**.

## V6. India compliance checklist

GST/ECO registration + TCS u/s 52 (0.5 % intra / 1 % inter on net taxable
value — CA config, professional sign-off before payouts live) · e-invoice IRN
hooks (B2B) · Consumer Protection (E-Commerce) Rules 2020 + 2027 amendments
(seller name/address/grievance contact on listings, grievance officer, 30-day
resolution, country-of-origin) · DPDP Act (consent, purpose limitation, retention
schedule, user export/erasure endpoints, breach notification) · RBI PA (payments
only via licensed aggregator; no self-pooling) · **DLT (every SMS via registered
sender + approved template — fail-closed)** · FDI marketplace conditions if
foreign investment later. Security: argon2id, OTP hashing, RBAC+RLS, webhook
signature+replay, virus-scan uploads, encrypted PAN/bank columns, append-only
audit/ledger, secrets never in code, weekly dependency audit.

## V7. Pilot launch checklist (Bijnor)

DLT + WhatsApp live in prod · gateway KYB + live keys + split configured ·
wildcard DNS/TLS verified from 3 networks · 20–50 shops × ≥20 products
(photos quality-checked) · ≥5 approved riders (seller self-delivery default ON) ·
support rota + grievance officer published · GST/TCS config CA-signed + first
settlement dry-run verified · load + pen sign-offs · flags: COD limited, AI off,
sponsored off · dashboards + SLO alerts live · rollback + incident runbooks
rehearsed.

---

# CLOSING — HOW TO USE THIS DOCUMENT

1. **Decide the open items:** domain scheme (recommended `shop.apnacity.com`),
   payment provider, business defaults (multi-shop cart / delivery modes /
   seller eligibility / pilot scope).
2. **Start external lead-time items now:** DLT templates, gateway onboarding, entity/GST.
3. **Build in order:** PART III Steps 0–18; each step's modules are fully
   specified in PART II.
4. **Per-module requests:** "Build M09" = implement exactly that section
   (tables + APIs + rules + acceptance) — nothing else needed.
5. **Gate discipline:** a step is done only when its Verify gate passes; a PR
   merges only per the Definition of Done.

*Detailed reference set: `spec/00–12` (this guide consolidates them).
Decision log: `spec/00-README.md` (D-001…D-015). ADRs: `adr/`.*
