# 05 — Module Catalogue (deep)

Format per backend module: **Responsibility · Endpoints · Entities owned ·
Events published → consumed · Business rules · Tests**.
Cross-module calls only via published interfaces; async via outbox events.

---

## M1 `auth`
- **Responsibility:** OTP request/verify (DLT SMS + WhatsApp fallback), password
  login, JWT issue/refresh/revoke, device sessions, token revocation.
- **Endpoints:** `/auth/*` (see 04 §3).
- **Entities:** `sessions`, refresh-token rotations (Redis).
- **Events:** `user.registered.v1` → notifications (welcome), analytics.
- **Rules:** OTP 6-digit, 5-min TTL, max 5 attempts / 15 min lockout, resend 60 s;
  OTP hash stored (never plaintext); rate limit per phone **and** per IP;
  JWT access 15 min claims `{sub, roles, shopId?, cityId?, ver}`; refresh rotates
  on use, reuse of an old refresh token revokes the whole family (theft detection).
- **Tests:** OTP lockout; refresh reuse-detection; revoked token 401; role claims.

## M2 `users`
- **Responsibility:** profiles, addresses, RBAC users/roles/permissions.
- **Entities:** `users`, `customer_profiles`, `addresses`, `roles`, `permissions`,
  `user_roles`.
- **Rules:** one user can be customer *and* seller; role upgrade never silently
  grants admin; address geocode on save (GeoCodingPort).
- **Tests:** role scoping (CITY_ADMIN cannot act cross-city without grant).

## M3 `geography`
- **Responsibility:** geo master data, serviceability lookups, distance/ETA
  primitives shared by search, checkout, delivery.
- **Entities:** `countries/states/cities/localities/pincodes`, `delivery_zones`.
- **APIs:** `/geo/*` (public, cache 24 h).
- **Rules:** serviceability = pincode match **OR** point-in-polygon (`ST_Contains`)
  **OR** shop within radius (`ST_DWithin`); fee/ETA from the most specific zone hit.
- **Tests:** point-in-polygon boundaries; pincode fallback.

## M4 `sellers`
- **Responsibility:** onboarding wizard state, KYC documents, bank/payout profile,
  verification workflow.
- **Entities:** `sellers`, `kyc_documents`, `bank_accounts`.
- **Events:** `kyc.submitted.v1`, `kyc.approved.v1` → shops (activate), notifications.
- **Rules:** PAN format check; GSTIN checksum validation + lookup (Phase 5 API);
  documents stored in private bucket, virus/MIME scan before accept; status machine per 06 §6.
- **Tests:** KYC state transitions; rejected re-submission flow.

## M5 `shops`
- **Responsibility:** shop aggregate (branding, settings, hours, policies) — the tenant.
- **Entities:** `shops`, `shop_settings`, opening-hours JSON schema.
- **Events:** `shop.created.v1`, `shop.updated.v1` → shop-domains (invalidate cache), search.
- **Rules:** slug allocation transactional; suspension cascades listing deactivation;
  rating recompute on review approval.
- **Tests:** slug uniqueness under race; suspend cascade.

## M6 `shop-domains`
- **Responsibility:** slug/host registry, resolve API for edge middleware, cache invalidation.
- **Entities:** `shop_domains`.
- **APIs:** `GET /internal/resolve-tenant?host=` (HMAC-signed response).
- **Rules:** unknown host → 404 redirect policy; host changes audited.
- **Tests:** resolution cache TTL; invalidation on shop rename.

## M7 `catalog`
- **Responsibility:** categories (tree + attribute_schema), brands, master products,
  variants, duplicate detection & merge queue.
- **Entities:** `categories`, `brands`, `products`, `product_variants`, `product_media`,
  `match_groups`.
- **Events:** `product.created.v1`, `product.merged.v1` → search-index.
- **Rules:** attribute values validated against category `attribute_schema`;
  GTIN match ⇒ auto-link to existing master; fuzzy candidates (name+brand+category
  trigram similarity > 0.75) go to a **human merge queue** (admin);
  category taxonomies governed by admin only — sellers cannot create categories.
- **Tests:** schema validation per category; GTIN dedupe; merge redirect of listings.

## M8 `listings`
- **Responsibility:** seller listings + per-variant price/MRP/SKU/tax, lifecycle.
- **Entities:** `seller_listings`, `listing_variants`.
- **Events:** `listing.published.v1` / `listing.updated.v1` / `listing.paused.v1`
  → search-index, storefront revalidate.
- **Rules:** `price <= mrp`; price-change history kept (`price_history` — audit);
  publishing requires ≥1 image + complete category-required attributes + stock;
  out-of-stock auto-flip when available = 0.
- **Tests:** publish validation matrix; price-overshoot rejection.

## M9 `inventory`
- **Responsibility:** stock truth, reservations, movements, low-stock alerts.
- **Entities:** `inventory_locations`, `stock`, `stock_movements`, `stock_reservations`.
- **Events:** `stock.low.v1`, `stock.out.v1` → notifications (seller), search (delist).
- **Rules:** the **only** stock mutation path is this module; atomic conditional
  `UPDATE` (see 03 §5); reservation consume on dispatch, release on cancel/reject/
  timeout; every mutation writes a `stock_movements` row in the same transaction;
  movement totals must reconcile to `stock` (nightly job, alert on drift).
- **Tests:** 100-parallel-order no-oversell; TTL release; movement reconciliation.

## M10 `media`
- **Responsibility:** signed upload URLs, derivative generation, CDN invalidation,
  MIME/virus scanning, per-shop quota.
- **Entities:** `media`.
- **Events:** `media.processed.v1` → listings (attach).
- **Rules:** max 6 images/listing, 5 MB/image, MIME allowlist (jpeg/png/webp),
  auto-convert to WebP + 256/512/1024 derivatives via sharp; EXIF strip
  (privacy); uploads accepted only with valid signed URL (10-min TTL).
- **Tests:** MIME spoof rejection; derivative generation; quota enforcement.

## M11 `search`
- **Responsibility:** `SearchPort` implementation, query parsing, ranking,
  suggestions, synonym management. Postgres FTS+trigram v1; OpenSearch Phase 4.
- **Entities:** `search_synonyms`; index projections from listings/products.
- **Rules:** city + serviceability filter first; ranking = relevance ×
  in-stock × rating, sponsored boost flag (explicitly labelled); typo tolerance
  via trigram; zero-results → suggestions + logged `search.miss` analytics event.
- **Tests:** relevance golden set; filter correctness; synonym expansion.

## M12 `cart`
- **Responsibility:** cart state, multi-shop grouping, revalidation on read.
- **Entities:** `carts`, `cart_items`.
- **Rules:** stale price/stock surfaced item-level on every read (never silent);
  max 50 items; anonymous cart (cookie) merges into user cart at login.
- **Tests:** merge; drift detection; quantity caps.

## M13 `checkout`
- **Responsibility:** quote (fees/ETA/coupon), payment intent, order creation
  orchestration (calls inventory.reserve + orders.create + payments.create).
- **Rules:** quote TTL 10 min; place-order is a **single DB transaction** writing:
  order + child orders + items + reservations + outbox (`order.placed.v1`)
  + payment row; Idempotency-Key mandatory; stock short → 422 with per-item details;
  COD gate: max COD value per user (risk), COD unavailable for first-order users
  above threshold (configurable).
- **Tests:** partial-stock rejection; idempotent replay; multi-shop split totals.

## M14 `orders`
- **Responsibility:** parent/child orders, state machine enforcement, events,
  cancellations, timeouts.
- **Entities:** `orders`, `seller_orders`, `order_items`, `order_events`.
- **Events:** `order.placed.v1`, `order.child.accepted.v1`, … → notifications,
  delivery, finance, analytics.
- **Rules:** transitions per 06 §1–2 only; role×transition guard; accept deadline
  default 10 min (auto-reject + release + refund); cancellation rules matrix
  (pre-accept free, post-accept per policy); snapshot integrity.
- **Tests:** every legal/illegal transition; timeout auto-reject; partial cancel totals.

## M15 `payments`
- **Responsibility:** `PaymentProviderPort` (Cashfree v1), webhooks, refunds, COD ledger.
- **Entities:** `payments`, `payment_transactions`, `refunds`, `webhook_events`.
- **Events:** `payment.captured.v1` → orders (confirm), finance (post ledger), notifications.
- **Rules:** verify signature + timestamp window + replay check against
  `webhook_events.external_ref`; webhook handling idempotent; refund per
  seller_order scope; COD reconciliation job against rider cash collection.
- **Tests:** replayed webhook ignored; bad signature 400; refund partial math.

## M16 `finance`
- **Responsibility:** double-entry ledger, commission engine, settlements,
  payout batches, statements.
- **Entities:** `ledger_accounts`, `ledger_entries`, `settlements`, `settlement_items`.
- **Events:** `settlement.paid.v1` → notifications.
- **Rules:** postings only via this module; balanced-transaction DB trigger;
  commission from `commissions` config (category × city, seller override);
  settlement cycle T+2 (configurable) over delivered+return-window-closed orders;
  TCS/TDS accrual per GST advisor config; statement PDF per settlement.
- **Tests:** ledger balances to gateway report; commission edge cases (refund clawback).

## M17 `delivery`
- **Responsibility:** serviceability & fee/ETA calculation, job creation, rider
  assignment engine, OTP/PoD, tracking, failed-delivery handling.
- **Entities:** `delivery_jobs`, `tracking_events`, `proof_of_delivery`, `shipment_links`.
- **Events:** `delivery.assigned.v1`, `delivery.delivered.v1`, `delivery.failed.v1`.
- **Rules:** assignment scores riders by distance (`ST_DWithin` + `ST_Distance`)
  × active workload × vehicle fit × rating — **not just nearest**; offer with
  60 s acceptance window, then next candidate; customer OTP (4-digit, hash-stored)
  shown in app + SMS; failed delivery → retry policy (2 attempts) → return-to-seller
  job; seller-self-delivery mode = same job rows, status updated from seller portal.
- **Tests:** assignment scoring; OTP verify; failure → reverse logistics path.

## M18 `delivery-partners`
- **Responsibility:** rider onboarding/KYC, availability, location pings, earnings.
- **Entities:** `delivery_partners`, `delivery_partner_zones`, rider `ledger_accounts`.
- **Rules:** offline > 5 min → auto unavailable; earnings = job fees + incentives,
  paid weekly (ledger→payout); GPS ping throttle 15 s, battery-aware on device.
- **Tests:** availability toggle; earnings aggregation.

## M19 `returns`
- **Responsibility:** return/exchange requests, policy windows, inspection, refund trigger.
- **Entities:** `return_requests`.
- **Events:** `return.approved.v1` → delivery (pickup job), finance (refund posting).
- **Rules:** window per category (default 7 days from delivery); non-returnable
  flags on category; auto-approve below ₹500 & reason ∈ {SIZE_ISSUE, CHANGED_MIND}
  if no history of abuse; inspection outcome drives refund or return-to-customer.
- **Tests:** window expiry; abuse gate; refund trigger.

## M20 `promotions`
- **Responsibility:** coupons (platform/city/shop), campaigns, redemption limits.
- **Rules:** validation stack (scope → window → min-order → limits); discount
  capped at item-level; free-delivery coupon applies to one shop group only.
- **Tests:** stacking prevention; per-user limits.

## M21 `reviews`
- **Responsibility:** verified-purchase reviews, moderation, rating aggregates.
- **Rules:** one review per order_item; edit window 7 days; profanity filter +
  manual moderation queue; aggregate recompute on approve.
- **Tests:** verified-purchase enforcement; aggregate recompute.

## M22 `notifications`
- **Responsibility:** template registry, multi-channel dispatch, preferences, DLT compliance.
- **Entities:** `notification_templates`, `notifications`, `notification_preferences`.
- **Rules:** every SMS references a **DLT-approved template id** (fail closed);
  WhatsApp via approved template names; channel fallback chain
  push → SMS for critical order events; transactional vs promotional classes
  respect DPDP consent; quiet hours for non-critical (21:00–08:00 IST).
- **Tests:** DLT gate; fallback chain; opt-out suppression.

## M23 `support`
- **Responsibility:** tickets, disputes, SLA timers, resolution workflow.
- **Entities:** `support_tickets`, `ticket_messages`.
- **Rules:** dispute freezes refund auto-flows; SLA by priority (URGENT 2 h);
  full order context attached automatically.
- **Tests:** SLA timers; dispute freeze.

## M24 `admin`
- **Responsibility:** approvals (sellers/shops/riders/categories), commissions,
  feature flags, ops actions — all audited.
- **Rules:** two-person rule for payout release; destructive ops require reason text.
- **Tests:** approval flows; audit emission.

## M25 `analytics`
- **Responsibility:** funnel events, dashboards (seller/city/platform), exports.
- **Rules:** writes async (queue), reads from rollup tables (hourly/daily jobs);
  seller sees only own shop; never raw PII in dashboards.
- **Tests:** rollup correctness; tenant scoping of reports.

## M26–M32 platform modules
- `audit` — append-only writer used by all privileged modules; query APIs for admin.
- `outbox` — dispatcher worker, retry/backoff, DLQ + alert; `event_id` dedupe.
- `webhooks` — inbound verification + outbound subscriptions (HMAC, retries).
- `feature-flags` — server-side eval API `GET /flags/eval?keys=` cached 30 s.
- `idempotency` — middleware storing request-hash → response; 24 h TTL.
- `invoicing` — GST invoice + credit notes per seller_order; e-invoice (IRN)
  hooks Phase 5 for GST-registered sellers; invoice numbering per GST series.
- `content` — city landing pages, banners, FAQ — CMS tables + admin CRUD.

---

## Frontend apps (module breakdown)

### `apps/web` (marketplace + city + shop storefront — one build)
- **Marketplace:** home (geo-select → city), category browse, search results
  (filters: price/brand/size/colour/shop/availability/distance/rating; sorts per
  01 §4.1), PDP with **offers table across shops for the selected variant**,
  cart (per-shop grouping + per-shop delivery fee), checkout (address picker,
  coupon, payment methods), orders + live tracking map, returns, reviews,
  account/addresses/wishlist.
- **City landing** (`bijnor.apnacity.com`): hero, featured shops, popular products,
  offers, SEO metadata + `sitemap.xml`.
- **Shop storefront** (`{slug}.apnacity.com`): branded chrome (logo/banner/theme
  from `shop_settings`), shop catalogue, shop search, shop policies, opening hours,
  contact; ISR + on-publish revalidation; per-tenant `robots.txt`, sitemap,
  canonical URLs, JSON-LD (`Store`, `Product`, `Offer`).
- **Tech notes:** Next.js App Router; server components for SEO pages; tenant
  resolved in middleware (02 §2.2); i18n `en`/`hi` via next-intl; optimistic cart
  updates with server revalidation.

### `apps/seller-portal` (PWA)
- Onboarding wizard (5 steps) → KYC upload → shop auto-created.
- **Product wizard:** (1) photos — camera capture, client-side compression,
  (2) details — category-driven dynamic form from `attribute_schema`, AI-assisted
  title/description (flagged, optional), (3) price/stock per variant,
  (4) delivery info, (5) publish → instant visibility on shop site + marketplace.
- Bulk CSV import with column mapping, row-level errors, progress UI.
- Orders inbox (sound + push on new order), accept/reject with reason, mark ready.
- Inventory grid with inline quick edit; low-stock badges.
- Payments: earnings, commission breakdown per order, settlement statements (PDF).
- Settings: shop profile, branding, delivery, GST/bank, staff users, language.
- **PWA:** installable, offline shell, background push.

### `apps/admin-portal`
- Approval queues (sellers/KYC, shops, product merge queue, reviews, riders).
- Ops: orders/disputes console with full `order_events` timeline; refunds; COD recon.
- Config: geography, taxonomy + attribute schemas, commissions, zones/fees,
  coupons, feature flags, DLT template registry.
- Analytics dashboards; audit log search.

### Mobile apps (Expo)
- **customer:** browse/search (cached lists), PDP, cart, checkout (UPI intent deep
  link), live tracking, OTP auth, push, deep links (`apnacity://order/123` +
  universal links), wishlist, Hindi/English.
- **seller:** camera upload wizard (reuse `packages/validation`), order alerts,
  accept/reject, quick stock edit, earnings.
- **rider:** availability toggle, job queue with accept timer, turn-by-turn deep
  link to maps, OTP entry, PoD photo, **offline job queue with local persistence
  + sync on reconnect**, earnings.

### Shared packages
- `ui` (design system incl. Hindi fonts), `api-client` (generated),
  `validation` (Zod schemas: listing, checkout, address…), `db`, `events`,
  `config` (env schema, constants, money helpers — paise formatting).



