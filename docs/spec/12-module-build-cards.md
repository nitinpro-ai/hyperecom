# 12 — Module Build Cards (independently buildable units)

> **Purpose:** each card is a self-contained work order. In future you can say
> **"Build M09"** (or "build the inventory module") and the card + its referenced
> spec slices are all the context needed — nothing else.
>
> **Request protocol:** `Build M<NN>` → context to load = this card + the exact
> spec references listed in *Refs*. Build order must respect *Prerequisites*.
> A card is DONE only when every item in *Accept* passes.

**Card fields:** Sprint/build step · Prerequisites (modules + build steps) ·
Provides (public interface) · Requires (consumed interfaces/events) · Owns
(tables) · Endpoints · Events out/in · Rules digest · Accept (tests) ·
Extract (future microservice path).

## Foundation layer (build first — everything depends on these)

### M27 — outbox
- **Build:** Phase 0 · Step 1–2. **Prereq:** packages/db, packages/events.
- **Provides:** `OutboxPort` — `publish(aggregateType, aggregateId, eventType, payload)` (writes row in caller's transaction); dispatcher worker (retry/backoff/DLQ, `event_id` dedupe).
- **Requires:** Redis/BullMQ (dispatcher), Prisma.
- **Owns:** `outbox_events`. **Endpoints:** none (internal).
- **Events in/out:** emits everything others publish (it *is* the bus).
- **Rules:** dispatch poll 1 s; backoff 1m→5m→30m→2h→6h; DEAD after; consumers idempotent.
- **Accept:** lost-update test (business row + outbox atomic); DLQ alert; duplicate consumer ignored.
- **Extract:** first candidate for extraction — becomes event bus service with HTTP ingest.

### M26 — audit
- **Build:** Phase 0 · Step 4. **Prereq:** M27, packages/db.
- **Provides:** `AuditPort` — `record(actor, action, entity, before, after)`.
- **Owns:** `audit_logs` (append-only; REVOKE UPDATE/DELETE in migration).
- **Accept:** privileged action without audit → test fails; tamper attempt rejected.
- **Extract:** immutable log sink service (Kinesis/S3-style) later.

### M30 — idempotency
- **Build:** Phase 0 · Step 4 (middleware), Phase 3 (full).
- **Provides:** NestJS interceptor: `Idempotency-Key` → hash → stored response (24 h).
- **Owns:** `idempotency_keys`. **Accept:** replay returns original response + same status.
- **Extract:** stays as shared infra (no extraction needed).

### M29 — feature-flags
- **Build:** Phase 0 · Step 4.
- **Provides:** `FlagsPort.eval(keys, context)` (30 s cache). **Owns:** `feature_flags`.
- **Accept:** flag change visible ≤ 30 s; default-safe when table unreachable.
- **Extract:** config service later.

## Identity & tenancy layer

### M01 — auth
- **Build:** Phase 0 · Step 4. **Prereq:** M27, M26, packages/config.
- **Provides:** `AuthPort` — issueTokens(userId), verifyAccess(jwt), rotateRefresh(token), revokeFamily(userId); OTP request/verify.
- **Requires:** DLT SMS provider port (dev: mailpit), Redis.
- **Owns:** (uses `users` via M02; sessions in Redis).
- **Endpoints:** `/auth/*` (04 §3).
- **Events out:** `user.registered.v1`.
- **Rules:** OTP hashed+peppered, TTL 5 min, 5 attempts→15 min lock, resend 60 s; JWT 15 min; refresh rotation + reuse detection (family revoke).
- **Accept:** lockout; reuse-revoke; revoked 401; claims correct per role.
- **Extract:** identity service (standard pattern; JWT verification stays local via public key).
- **Refs:** 05 M1 · 08 §2 · 11 §3 (OTP template).

### M02 — users
- **Build:** Phase 0 · Step 4. **Prereq:** M01.
- **Provides:** `UsersPort` — profiles, addresses (geocoded), role grants (`user_roles`).
- **Owns:** `users`, `customer_profiles`, `addresses`, `roles`, `permissions`, `user_roles`.
- **Events out:** `address.created.v1`.
- **Accept:** CITY_ADMIN cross-city denial; one user multi-role (customer+seller).
- **Refs:** 03 §3 · 08 §1.

### M03 — geography
- **Build:** Phase 0 · Step 2. **Prereq:** packages/db.
- **Provides:** `GeoPort` — serviceable?(shopPoint, dropPoint/pincode), zoneFeeETA(cityId, distance), detect(lat,lng), pincode lookup.
- **Owns:** `countries/states/cities/localities/pincodes`, `delivery_zones`, `geocode_cache`.
- **Endpoints:** `/geo/*` (public, 24 h cache).
- **Accept:** point-in-polygon boundary cases; pincode fallback; fee slab math.
- **Extract:** geo/pricing service (hot path for checkout+delivery).
- **Refs:** 03 §2 · 11 §6 (data sources).

### M04 — sellers
- **Build:** Phase 1 · Step 5. **Prereq:** M01, M02, M10 (media), M24 (admin approval).
- **Provides:** `SellersPort` — register, submitKyc, status of, listForAdmin.
- **Owns:** `sellers`, `kyc_documents`, `bank_accounts`.
- **Events out:** `kyc.submitted.v1`, `kyc.approved.v1`.
- **Rules:** PAN regex+checksum; GSTIN checksum; docs in private bucket; state machine 06 §6.
- **Accept:** KYC transitions; rejected→resubmit; docs not public.
- **Extract:** onboarding/KYC service (vendor API swap behind `KycVerificationPort`).
- **Refs:** 05 M4 · 06 §6 · 08 §2.

### M05 — shops
- **Build:** Phase 1 · Step 5. **Prereq:** M04, M03 (city), M10.
- **Provides:** `ShopsPort` — create (allocates slug), update, suspend, settings, resolveBySlug.
- **Owns:** `shops`, `shop_settings`.
- **Events out:** `shop.created.v1`, `shop.updated.v1`, `shop.suspended.v1`.
- **Accept:** slug race (one winner); suspend cascades listings→PAUSED; branding renders on storefront.
- **Extract:** tenant-registry service (host resolution hot path).
- **Refs:** 03 §3 · 05 M5.

### M06 — shop-domains
- **Build:** Phase 1 · Step 5. **Prereq:** M05, M03.
- **Provides:** `resolveTenant(host)` → {shopId, slug, cityId} + HMAC proof; cache invalidation.
- **Owns:** `shop_domains`.
- **Endpoints:** `GET /internal/resolve-tenant` · `GET /storefront/resolve`.
- **Accept:** 60 s cache TTL + invalidation on shop rename; unknown host 404.
- **Extract:** with M05 as tenant-registry service.

### M10 — media
- **Build:** Phase 1 · Step 6. **Prereq:** M27 (queue), S3 port.
- **Provides:** `MediaPort` — signedUploadUrl(owner, kind), attach(ref), variants(mediaId).
- **Owns:** `media`.
- **Events out:** `media.processed.v1`.
- **Rules:** MIME allowlist + content sniff; ≤6 images/listing; WebP 256/512/1024; EXIF strip; private bucket for DOCUMENT kind.
- **Accept:** spoof reject; derivative < 10 s; quota; private URLs expire.
- **Extract:** asset pipeline service (queue-heavy — good candidate).

## Catalogue layer

### M07 — catalog
- **Build:** Phase 2 · Steps 5–7 (schema Step 2). **Prereq:** M10, M24 (taxonomy admin).
- **Provides:** `CatalogPort` — categories/tree/attributeSchema, createProduct (or match existing), variants, mergeQueue.
- **Owns:** `categories`, `brands`, `products`, `product_variants`, `product_media`, `match_groups`.
- **Events out:** `product.created.v1`, `product.merged.v1`.
- **Rules:** GTIN auto-match; trigram >0.75 → human merge queue; attribute validation per schema snapshot.
- **Accept:** GTIN dedupe; schema validation; merge redirects listings.
- **Extract:** catalogue service (read-replicated for search/PDP).
- **Refs:** 03 §4 · 05 M7.

### M08 — listings
- **Build:** Phase 1 · Step 7. **Prereq:** M07, M09, M10, M05.
- **Provides:** `ListingsPort` — publishDraft (wizard), quickEdit(variant, price/stock), pause/resume, byShop, byProduct(offers).
- **Owns:** `seller_listings`, `listing_variants`, `price_history`.
- **Events out:** `listing.published/updated/paused.v1`.
- **Rules:** price≤MRP; publish requires images+attrs+stock; auto OUT_OF_STOCK at 0.
- **Accept:** publish validation matrix; price history recorded; offers query same-variant only.
- **Extract:** with M07.
- **Refs:** 03 §5 · 06 §5.

### M09 — inventory
- **Build:** Phase 2 · Step 8. **Prereq:** M08 (stock rows on publish), M27.
- **Provides:** `InventoryPort` — reserve(items)→reservations, release(ids), consume(ids), adjust(stockId, delta, reason), availability(variantIds).
- **Requires:** tenant context; timer queue.
- **Owns:** `inventory_locations`, `stock`, `stock_movements`, `stock_reservations`.
- **Events in:** `listing.published.v1` (init stock), cancellation events (release).
- **Events out:** `stock.low.v1`, `stock.out.v1`, `stock.reconciled.v1`.
- **Rules:** atomic conditional UPDATE is the only mutation path; movements append-only same-tx; TTL release 30 min; nightly reconciliation.
- **Accept:** 100-parallel no-oversell; TTL restore; zero-drift reconciliation; RLS isolation.
- **Extract:** inventory service (strong candidate — hot path, strong invariants).
- **Refs:** 03 §5 · 05 M9 · 06 §8.

### M11 — search
- **Build:** Phase 3 · Step 10 (interface in Phase 2). **Prereq:** M08 (events), M03 (city filter).
- **Provides:** `SearchPort` — query(filters, sort, cursor), suggest(q), synonyms CRUD.
- **Owns:** `search_synonyms`; projections of listings (no source tables).
- **Events in:** `listing.*`, `product.*`, `stock.*`.
- **Rules:** Postgres FTS+trigram+PostGIS v1; ranking relevance×in-stock×rating; city+serviceability first; sponsored flag explicit.
- **Accept:** golden set; typo tolerance; p95 < 300 ms @ 50k listings.
- **Extract:** search service with OpenSearch (this port exists precisely for that).
- **Refs:** 05 M11 · 02 §6.

## Commerce layer

### M12 — cart
- **Build:** Phase 3 · Step 11. **Prereq:** M08, M09.
- **Provides:** `CartPort` — get(revalidate), addItem, updateQty, remove, mergeAnonymous.
- **Owns:** `carts`, `cart_items`.
- **Rules:** item-level drift surfaced on read; ≤50 items; one open cart per user.
- **Accept:** anon→user merge; drift detection; caps.
- **Refs:** 03 §6 · 05 M12.

### M13 — checkout
- **Build:** Phase 3 · Step 11. **Prereq:** M12, M03 (fees), M20 (coupons), M15 (intent), M09, M14.
- **Provides:** `CheckoutPort` — quote(cartId, address, coupon)→Quote(TTL 10 min), place(quoteId, Idempotency-Key)→orderId.
- **Owns:** no tables (orchestrates; writes via M14/M09/M15 ports in ONE transaction).
- **Rules:** single-transaction place (order+children+items+reservations+outbox+payment row); stock short → 422 per-item; COD risk gates.
- **Accept:** 3-shop split totals; idempotent replay; 422 flow; quote expiry.
- **Refs:** 11 §1 (sequence) · 05 M13 · 06 §1.

### M14 — orders
- **Build:** Phase 3–4 · Steps 11–12. **Prereq:** M09, M15, M17, M27.
- **Provides:** `OrdersPort` — create(snapshots), transition(sellerOrderId, action, actor) [state machine], events timeline, cancel paths.
- **Owns:** `orders`, `seller_orders`, `order_items`, `order_events`.
- **Events out:** `order.placed.v1`, `order.child.*.v1`, `order.cancelled.v1`.
- **Rules:** transitions only per 06 §1–2 matrices; timers per 06 §8; snapshots immutable.
- **Accept:** full transition matrix test; timeout auto-reject; partial-cancel totals; event history complete.
- **Extract:** OMS service (classic candidate at scale).
- **Refs:** 06 §1–2, §8 · 03 §7.

### M15 — payments
- **Build:** Phase 3 · Step 11. **Prereq:** M27, M30, `PaymentProviderPort` (Cashfree sandbox).
- **Provides:** `PaymentsPort` — createIntent(order), handleWebhook(provider, signedPayload), refund(scope, amount).
- **Owns:** `payments`, `payment_transactions`, `refunds`, `webhook_events`.
- **Events out:** `payment.captured.v1`, `refund.completed.v1`.
- **Rules:** webhook = only capture authority; signature+timestamp+replay; refunds scoped to child order/items; COD recon job.
- **Accept:** replay ignored; bad signature 400; partial refund math.
- **Extract:** payments service (compliance isolation; provider swap via port).
- **Refs:** 06 §3 · 11 §1 · 08 §2.

### M16 — finance
- **Build:** Phase 5 · Step 15. **Prereq:** M15, M14, M31 (invoices).
- **Provides:** `FinancePort` — post(transactionType, source, lines[]), sellerBalance, runSettlement(period), statement(settlementId).
- **Owns:** `ledger_accounts`, `ledger_entries`, `settlements`, `settlement_items`, `commissions` config.
- **Events in:** `payment.captured.v1`, `refund.*`, `delivery.delivered.v1`.
- **Rules:** balanced-per-transaction DB trigger; append-only; T+2 settlement over CLOSED children; TCS/TDS per config; two-person payout release.
- **Accept:** worked example 11 §2 reproduces exactly; gateway reconciliation to the paisa.
- **Extract:** finance service (strong candidate — audit isolation).
- **Refs:** 03 §8 · 11 §2 · 08 §3.

### M20 — promotions
- **Build:** Phase 3 (coupon at checkout) · extendable. **Prereq:** M13.
- **Provides:** `PromotionsPort` — validate(cart, code)→discount lines, redemption record.
- **Owns:** `coupons`, `coupon_redemptions`, `campaigns` (Phase 7).
- **Accept:** scope/window/limits stack rules; free-delivery applies to one shop group.
- **Refs:** 03 §11 · 05 M20.

### M21 — reviews
- **Build:** Phase 4 (post-delivery). **Prereq:** M14.
- **Provides:** `ReviewsPort` — submit(verified orderItem), moderate, aggregates(product, shop).
- **Owns:** `reviews`.
- **Accept:** one review per item; verified-purchase enforcement; aggregate recompute exact.
- **Refs:** 03 §10 · 05 M21.

## Logistics & communication layer

### M17 — delivery
- **Build:** Phase 4 · Step 13. **Prereq:** M14, M03, M18.
- **Provides:** `DeliveryPort` — serviceable+fee+ETA, createJob(childOrder), assign(job) [scoring], transitionStatus(job, action, actor), otpVerify, pod, track(jobId).
- **Owns:** `delivery_jobs`, `tracking_events`, `proof_of_delivery`, `shipment_links`.
- **Events out:** `delivery.assigned/delivered/failed.v1`.
- **Rules:** score = distance × workload × vehicle × rating; 60-s offer window; retry ×2 → return-to-seller; seller-self mode same rows.
- **Accept:** scoring order; OTP fail path; reverse logistics job.
- **Extract:** logistics service (`LogisticsPort` already fits 3PL swap).
- **Refs:** 03 §9 · 06 §7.

### M18 — delivery-partners
- **Build:** Phase 4 · Step 13. **Prereq:** M01, M24 (KYC approval), M16 (earnings ledger).
- **Provides:** `RidersPort` — register, availability, ping(location), jobs, earnings.
- **Owns:** `delivery_partners`, `delivery_partner_zones`.
- **Accept:** offline 5 min → unavailable; weekly earnings aggregation.
- **Refs:** 03 §9 · 05 M18.

### M19 — returns
- **Build:** Phase 4 · Step 14. **Prereq:** M17 (pickup jobs), M15 (refund), M23 (disputes).
- **Provides:** `ReturnsPort` — request(item), approve/reject, inspection outcome.
- **Owns:** `return_requests`.
- **Events out:** `return.approved.v1` → M17 job + M16 refund posting.
- **Accept:** window expiry; auto-approve gate; inspection-failed freeze.
- **Refs:** 06 §4 · 03 §10.

### M22 — notifications
- **Build:** Phase 4 · Step 14. **Prereq:** M27, channel ports (DLT/FCM/WhatsApp/email).
- **Provides:** `NotifyPort` — send(templateCode, recipient, vars), preferences CRUD.
- **Owns:** `notification_templates`, `notifications`, `notification_preferences`.
- **Events in:** all order/payment/delivery/settlement events.
- **Rules:** DLT template id mandatory for SMS (fail-closed); fallback chain; quiet hours non-critical; template catalogue 11 §3.
- **Accept:** fail-closed test; < 5 s p95 order alert; opt-out suppression.
- **Extract:** notification service (fan-out heavy — first extraction candidate with M27).
- **Refs:** 11 §3 · 05 M22.

### M23 — support
- **Build:** Phase 4 · Step 14. **Prereq:** M14.
- **Provides:** `SupportPort` — open ticket, reply, escalate, resolve; dispute freeze hooks into M15/M19.
- **Owns:** `support_tickets`, `ticket_messages`.
- **Accept:** SLA timers; dispute freezes refund.
- **Refs:** 03 §12 · 05 M23.

## Platform layer

### M24 — admin
- **Build:** Phase 1 onward (approval queues first) · Step 16 completes. **Prereq:** M04/M05/M18 approvals, M26.
- **Provides:** admin ops APIs (04 §3) + two-person payout rule with M16.
- **Accept:** every action audited; approval queue SLA; commission change audited.
- **Refs:** 08 §1 · 05 M24.

### M25 — analytics
- **Build:** Phase 5 · Step 16. **Prereq:** M27 (events).
- **Provides:** `AnalyticsPort` — track(event, payload), dashboards(shop/city/platform), exports.
- **Owns:** `analytics_events` (partitioned) + rollup tables.
- **Accept:** rollup correctness; tenant scoping; no PII in dashboards.
- **Extract:** analytics service (own DB, big first candidate).
- **Refs:** 03 §13 · 09 §3.

### M28 — webhooks
- **Build:** Phase 3 (inbound with M15) · Phase 5+ (outbound). **Prereq:** M27, M30.
- **Provides:** outbound subscriptions (HMAC, retries 1m/5m/30m/2h/6h) + management API.
- **Owns:** `webhook_subscriptions`.
- **Refs:** 04 §5.

### M31 — invoicing
- **Build:** Phase 5 · Step 15. **Prereq:** M14, M16.
- **Provides:** `InvoicePort` — generate(childOrder), creditNote(refund), GST series numbering; e-invoice IRN hooks.
- **Owns:** `invoices`, `credit_notes`.
- **Accept:** invoice per child order; numbering per series; credit note on refund.
- **Refs:** 08 §3.

### M32 — content
- **Build:** Phase 7 · Step 18. **Prereq:** M24.
- **Provides:** city landing pages, banners, FAQ — CMS CRUD + public read APIs.
- **Owns:** `pages`, `banners`, `faqs`.
- **Refs:** 05 M32.

## Build-order dependency graph

```
M27 outbox ─┬─ M26 audit ─ M01 auth ─ M02 users ─ M04 sellers ─ M05 shops ─ M06 domains
            ├─ M30 idem ─ M15 payments ─ M16 finance ─ M31 invoicing
            └─ M03 geography ─ M10 media ─ M07 catalog ─ M08 listings ─ M09 inventory
M08+M09 ─ M11 search ─ M12 cart ─ M13 checkout (needs M15,M14,M20) ─ M14 orders
M14 ─ M17 delivery (M18 riders) ─ M19 returns ─ M22 notify ─ M23 support
M25 analytics · M24 admin · M28 webhooks · M29 flags · M32 content (parallel tracks)
```

Safe request order for future "build module X" sessions:
`M27 → M26 → M30 → M29 → M01 → M02 → M03 → M10 → M04 → M05 → M06 → M07 → M08 →
M09 → M11 → M12 → M15 → M14 → M13 → M20 → M17 → M18 → M19 → M22 → M23 → M24 →
M16 → M31 → M25 → M28 → M32` (M16 needs M15+M14 done; M31 with M16).



