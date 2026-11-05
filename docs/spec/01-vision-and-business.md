# 01 — Vision & Business Specification

## 1. Positioning

ApnaCity is a **hyperlocal multi-vendor e-commerce marketplace** — "Amazon, but
city-first and shop-first". The differentiator is not catalogue depth; it is that
**every listing comes from a real shop you can walk into**, within your city, with
price comparison across those shops and local delivery.

> One-line pitch: *Search a product in your city → compare real prices from real
> local shops → order → delivered today by a local rider.*

## 2. Product principles (in priority order)

1. **Seller simplicity** — a shopkeeper with limited technical skill registers,
   uploads 20 products, and receives orders within 15–30 minutes, unaided.
2. **One-time upload** — a product published once is live on the shop site, the
   marketplace, city search and mobile apps. No double entry, ever.
3. **Stock truth** — no overselling under any concurrency. Inventory is sacred.
4. **Financial transparency** — every shopkeeper sees order-wise commission and
   a payout statement they can reconcile themselves.
5. **City as a unit** — adding a city is configuration + onboarding, never a
   new development project.

## 3. Personas

| Persona | Needs | Pain we solve |
|---------|-------|---------------|
| **Customer (Priya, 28)** | Finds exact product nearby, compares price, gets it today, tracks it | Delivery from metro apps takes days; local shops invisible online |
| **Shopkeeper (Bagga, 52)** | Sells online without learning "software"; Hindi; phone camera is enough | Existing portals are complex, English-only, desktop-first |
| **Rider (Imran, 24)** | Simple jobs, clear earnings, offline-tolerant app | Payment disputes, unclear routes |
| **City admin** | Approve shops, monitor ops, resolve disputes in one city | Spreadsheets |
| **Platform admin** | Commission, settlements, growth, compliance | No single pane of glass |
| **Support agent** | Resolve order/refund disputes with full history | Context scattered across tools |

## 4. Core journeys

### 4.1 Customer purchase journey
1. Open `apnacity.com` → select India → Uttar Pradesh → Bijnor (or auto-detect by GPS/pincode).
2. Search e.g. "Nike shoes".
3. Results = matching master products with **offers from Bijnor shops**, each showing
   price, MRP, distance, stock, delivery ETA, shop rating.
4. Sort: price low→high / nearest / fastest delivery / highest rating.
5. Open product → see per-shop offer table, shop details, images, policies.
6. Add to cart (possibly from multiple shops) → one checkout → one payment →
   split into per-shop child orders.
7. Shopkeeper receives instant order notification → accepts → packs → ready.
8. Rider assigned (or shop self-delivers) → pickup → out for delivery →
   customer tracks live → OTP at door → delivered.
9. Settlement runs; commission posted to ledger; both parties can see the money trail.

### 4.2 Shopkeeper journey
1. Register with mobile OTP → shop name → state/city → address → categories →
   logo/banner → KYC docs (PAN, GST optional, bank).
2. System auto-allocates slug → storefront live at `bagga-cloth.apnacity.com`.
3. 5-step product wizard: photos (camera) → details → price/stock → delivery → publish.
4. Product appears on own site + marketplace instantly.
5. Orders screen: accept/reject with one tap; quick stock edits from phone.
6. Payments screen: earnings, commission, payout date, downloadable statement.

### 4.3 Rider journey
1. Register → KYC → availability toggle ON.
2. Job queue: pickup → navigate → deliver → OTP/PoD photo.
3. Offline queue syncs when connectivity returns.
4. Daily earnings + history.

## 5. Scope

### 5.1 In scope (platform v1 → pilot)
- Multi-state/city/locality geography with serviceability
- Seller onboarding, KYC, shop creation, auto storefront websites
- Master catalogue + per-shop listings + variants + inventory
- Search, filters, sorting, price comparison across shops
- Cart, multi-shop checkout, payments (UPI/cards/netbanking/COD), refunds
- Order lifecycle with parent/child orders, seller acceptance
- Delivery: own riders + seller self-delivery; OTP/PoD; returns
- Commission, double-entry ledger, settlements, GST invoices
- Notifications: DLT SMS, WhatsApp, push, email
- Reviews, coupons (platform + shop), support tickets/disputes
- Admin portal, seller portal (PWA), customer/seller/rider mobile apps
- Hindi + English UI (seller portal and customer app)

### 5.2 Out of scope for v1 (architecture must not prevent)
- ONDC integration (separate project; keep catalogue/service interfaces ONDC-shaped)
- B2B wholesale tier
- Intercity/3PL logistics (adapter stub only)
- AI description/image generation (behind feature flag, Phase 7)
- Advertising self-serve platform
- Subscriptions/loyalty programme
- Perishable/batch/expiry management (grocery deep features)
- Multi-currency (India only, INR only)

## 6. Business decisions (answered for legacy open questions)

| Legacy question | Decision |
|-----------------|----------|
| Who handles delivery? | **Both** — ApnaCity riders + seller self-delivery; 3PL adapters later (D-005) |
| Multi-shop checkout? | **Yes** — one cart/one payment → parent/child orders (D-004) |
| Who can sell? | **Any local shopkeeper after KYC** (D-006); GST optional at onboarding, required for GST-category goods |
| Product categories? | **All general retail initially**; regulated categories gated behind admin approval (D-007) |
| Legal entity? | **India entity, India operations** (D-008) |

## 7. Revenue model

| Stream | Mechanism | v1? |
|--------|-----------|-----|
| Order commission | % per successful order (configurable per category/city) | ✅ |
| Delivery fee | Customer or seller pays; zone + distance slabs | ✅ |
| Seller subscription | Monthly premium shop plans | Phase 7 |
| Featured products/shops | Paid visibility in city search | Phase 7 |
| Local advertising | Sponsored banners on city landing pages | Phase 7 |
| Premium storefront | Custom branding/themes | Later |
| Advanced analytics | Paid seller reports | Later |

**Illustrative unit economics** (not a forecast): 1,000 orders/day × ₹700 AOV ×
5% commission = ₹35,000/day = ₹10.5 L/month gross commission before GST, gateway
fees, delivery, support, marketing and opex.

## 8. Pilot success criteria (Bijnor, first 90 days)

| Metric | Target |
|--------|--------|
| Shops onboarded | 20–50 |
| Products published per shop (median) | ≥ 20 |
| Product upload success without support | ≥ 80 % |
| Time to first publish (median) | < 15 min |
| Order acceptance rate (seller) | ≥ 85 % |
| Stock accuracy (order vs. actual) | ≥ 97 % |
| Median fulfilment (order → dispatch) | < 90 min |
| Delivery success first attempt | ≥ 90 % |
| Repeat purchase within 60 days | ≥ 25 % |
| Refund/return rate | < 5 % |
| p95 search latency | < 300 ms |

## 9. Open items requiring business sign-off

1. Payment provider commercial terms (Cashfree vs Razorpay).
2. Commission slab table per category (default 2–8 %).
3. Delivery fee slabs and free-delivery threshold.
4. Return window policy per category (default 7 days, non-returnable for
   innerwear/fragrance/perishables).
5. KYC document set and verification SLA (manual in v1 → provider API later).
6. DLT sender ID + template registration owner and timeline.
7. Domain scheme confirmation (D-009).

