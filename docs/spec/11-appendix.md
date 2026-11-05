# 11 — Appendix (sequences, worked examples, references)

## 1. Checkout & payment sequence (authoritative flow)

```mermaid
sequenceDiagram
  participant C as Customer (web/app)
  participant W as apps/web
  participant A as API (checkout)
  participant I as inventory module
  participant P as payments (Cashfree)
  participant G as Gateway
  participant O as orders module
  participant F as finance
  participant N as notifications

  C->>W: checkout (address, coupon)
  W->>A: POST /checkout/quote
  A->>A: group items by shop → zone fee per shop → ETA → coupon check
  A-->>W: quote (per-shop fees, total, TTL 10 min)
  W->>A: POST /checkout/payment-intent
  A->>P: create order (provider)
  P->>G: create provider order
  G-->>P: provider_order_ref
  P-->>A: payment CREATED + ref
  A-->>W: payment ref + checkout params
  W->>G: customer pays (UPI/card/COD select)
  G->>P: POST /webhooks/payments/cashfree (signed)
  P->>P: verify signature + replay check
  P->>O: emit payment.captured.v1 (outbox)
  O->>I: reserve(items)  [atomic conditional update]
  I-->>O: reserved ok / insufficient
  O->>O: create parent order + child orders + snapshots + order_events + outbox(order.placed.v1)
  O->>F: emit finance posting request
  F->>F: ledger: debit Customer Receivable / credit Sales Payable per seller + commission
  O->>N: emit notify (customer + each seller)
  N-->>C: push/SMS/WhatsApp "order placed"
  N-->>C: seller push + SMS + sound (portal)
  Note over O: reservation TTL timer armed (30 min)
```

Failure branches: insufficient stock → 422 per-item (no order rows written);
payment webhook replay → ignored (`webhook_events.external_ref` unique);
quote expiry (10 min) → new quote required.

## 2. Worked double-entry ledger example

Order: Bagga Cloth shirt ₹1,000.00 (100000 paise), 5% commission (5000p),
gateway fee 2% (2000p), delivery fee ₹50 (5000p, customer-paid), GST-inclusive
pricing (tax extracted at 5% = 4762p of item).

**T-1001 — payment captured (₹1,050 paid by customer):**
| Account (owner) | Debit | Credit |
|---|---|---|
| Customer Receivable (platform) | 105000 | |
| Sales Payable — Bagga Cloth (seller) | | 100000 |
| Delivery Income (platform) | | 5000 |

**T-1002 — commission earned:**
| Account | Debit | Credit |
|---|---|---|
| Commission Income (platform) | 5000 | |
| Sales Payable — Bagga Cloth | | 5000 |

**T-1003 — gateway fee accrued:**
| Account | Debit | Credit |
|---|---|---|
| Gateway Fee (platform) | 2000 | |
| Bank/Clearing (platform) | | 2000 |

> Seller payable balance now = 95000 paise (₹950). Settlement (T+2) posts
> T-1004: debit Sales Payable 95000 / credit Bank 95000 + payout ref (UTR).

**Refund clawback (item returned, full ₹1,000 refund):**
| T-1005 | Debit | Credit |
|---|---|---|
| Sales Payable — seller | 100000 | |
| Refund Claim (platform) | | 95000 |
| Commission Income (platform) | | 5000 |

Invariant: Σdebit = Σcredit per transaction — enforced by DB trigger (03 §8).
TCS/TDS accrual rows are added per CA-supplied config (08 §3) — same pattern.

## 3. Notification template catalogue (DLT/WhatsApp register-first)

| Code | Channel | Trigger | Recipient | DLT? |
|------|---------|---------|-----------|------|
| OTP_LOGIN | SMS+WhatsApp | auth | all | YES |
| WELCOME_CUSTOMER | SMS+email | signup | customer | YES (SMS) |
| SELLER_KYC_APPROVED | SMS+push | kyc.approved | seller | YES (SMS) |
| ORDER_PLACED_CUSTOMER | push+SMS | order.placed | customer | YES (SMS) |
| ORDER_NEW_SELLER | push+SMS+sound | order.placed | seller | YES (SMS) |
| ORDER_ACCEPTED_CUSTOMER | push | child accepted | customer | no (push-first) |
| ORDER_REJECTED_CUSTOMER | push+SMS | child rejected | customer | YES (SMS) |
| ORDER_OUT_FOR_DELIVERY | push+WhatsApp | status | customer | WhatsApp tmpl |
| ORDER_DELIVERED_CUSTOMER | push | delivered | customer | no |
| DELIVERY_OTP | SMS | dispatched | customer | YES |
| ORDER_RETURN_APPROVED | push+email | return approved | customer | no |
| REFUND_COMPLETED | SMS+push | refund done | customer | YES (SMS) |
| STOCK_LOW_SELLER | push+email | stock.low | seller | no |
| SETTLEMENT_PAID_SELLER | SMS+email | settlement.paid | seller | YES (SMS) |
| RIDER_NEW_JOB | push | delivery.assigned | rider | no |
| TICKET_REPLY | email+inapp | ticket message | any | no |
| ORDER_CANCELLED_* | push+SMS | cancellation | both | YES (SMS) |
| PASSWORD_RESET | SMS+email | request | any | YES (SMS) |

Rules: every SMS template must exist in `notification_templates` with a
non-empty `dlt_template_id` **before** the notification module will send it
(fail-closed). Hindi + English variants for every template.

## 4. CI/CD pipeline (GitHub Actions)

```
on: pull_request →
  job lint        pnpm turbo lint
  job typecheck   pnpm turbo build (tsc --noEmit)
  job unit        pnpm turbo test
  job integration docker compose up db,redis,minio → pnpm turbo test:integration
  job api-client  build api → openapi spec diff → regenerate packages/api-client
                  → fail if regenerated files differ from committed ones
  job tenancy     dedicated tenant-isolation suite (attempts cross-tenant access
                  on every tenant table — must all fail)

on: push main →
  job build-images (api, web, seller-portal, admin-portal) → push registry
  job migrate-staging → deploy staging (blue/green) → smoke tests (/health,
  storefront 200, tenant resolve) → e2e (Playwright golden journeys)

on: tag v* →
  job migrate-prod (manual approval gate) → deploy prod → smoke → notify
```

Mobile (separate workflow, Phase 6): EAS build on tag → submit →
staged rollout 10→50→100 % with crash-rate gate.

## 5. Environment variables reference (`.env.example`)

```bash
# core
NODE_ENV=development
API_BASE_URL=http://localhost:4000
WEB_BASE_URL=http://localhost:3000
APP_DOMAIN=apnacity.com
TENANT_RESOLVE_HMAC_SECRET=   # HMAC for x-tenant-proof
# database
DATABASE_URL=postgresql://apnacity:apnacity@localhost:5432/apnacity
DB_POOL_MAX=20
# redis
REDIS_URL=redis://localhost:6379
# storage
S3_ENDPOINT=http://localhost:9000   # minio dev
S3_REGION=us-east-1
S3_BUCKET_PUBLIC=apnacity-media
S3_BUCKET_PRIVATE=apnacity-docs
S3_ACCESS_KEY_ID=  S3_SECRET_ACCESS_KEY=
CDN_BASE_URL=
# auth
JWT_ACCESS_SECRET=  JWT_ACCESS_TTL=900
REFRESH_SECRET=  OTP_HASH_PEPPER=
# payments
PAYMENT_PROVIDER=cashfree
CASHFREE_APP_ID=  CASHFREE_SECRET_KEY=  CASHFREE_WEBHOOK_SECRET=
# notifications
DLT_SMS_PROVIDER=  DLT_SENDER_ID=  DLT_API_KEY=
WHATSAPP_TOKEN=  WHATSAPP_PHONE_ID=
FCM_SERVER_KEY=  APNS_KEY_ID=  APNS_KEY=
EMAIL_FROM=  SMTP_URL=   # SES/Resend in prod
# maps
GEO_PROVIDER=google  GOOGLE_MAPS_KEY=
# misc
SENTRY_DSN=  OTEL_EXPORTER_OTLP_ENDPOINT=
FEATURE_FLAG_DEFAULTS={}   # JSON
```
All values Zod-validated at boot; unknown/missing → refuse to start.

## 6. India geography data sources (seed)

| Data | Source | Notes |
|------|--------|-------|
| States/districts | LGD (Local Government Directory, lgdirectory.gov.in) reports | authoritative codes |
| Pincode directory | India Post pincode CSV (data.gov.in, updated quarterly) | office → district mapping |
| City/locality boundaries | OSM boundaries + manual curation for pilot cities | pilot: Bijnor manual first |
| Geocoding fallback | Google Maps API | cache every result (table `geocode_cache`) |

Pilot rule: seed **Bijnor fully by hand** (all localities/pincodes verified on
ground during shop onboarding) before trusting bulk datasets.

## 7. Requirements coverage matrix (legacy → this spec)

| Legacy requirement | Where covered |
|--------------------|---------------|
| concept.MD M1 central marketplace | 05 web · 02 §4 |
| M2 seller portal | 05 seller-portal · 10 Step 5–7 |
| M3 shop website builder | 02 §3–4 · 05 storefront · 03 shops/shop_domains |
| M4 delivery management | 05 M17–M18 · 06 §7 |
| M5 OMS | 06 §1–2 · 03 §7 |
| M6 payment & settlement | 05 M15–M16 · 11 §2 |
| M7 catalogue & inventory | 03 §4–5 · 05 M7–M9 |
| M8 search & discovery | 05 M11 · 10 Step 10 |
| M9 admin dashboard | 05 M24 · 10 Step 16 |
| M10 notifications | 05 M22 · 11 §3 |
| M11 offers/coupons/loyalty | 05 M20 (loyalty: Phase 7, 01 §5.2) |
| M12 delivery partner app | 05 mobile-rider |
| M13 customer account | 05 web + M2 |
| M14 support | 05 M23 · 03 §12 |
| M15 analytics | 05 M25 · 09 §3 |
| implimentation.MD §2 stack | BUILD-PLAN §3 |
| §3 multi-tenancy | 02 §2 · 03 §14 |
| §4 roles | 08 §1 |
| §5 core modules (28) | 05 M1–M32 (superset) |
| §6 catalogue design | 03 §4 · D-002 |
| §7 seller portal | 05 seller-portal · 11 §3 |
| §8 marketplace UI | 05 web |
| §9 order management | 06 · 04 §3 |
| §10 payment & finance | 05 M15–M16 · 11 §1–2 |
| §11 delivery management | 05 M17 · 02 §6 ports |
| §12 shop website | 02 §3–4 · 10 Step 9 |
| §13 mobile applications | 05 mobile · 10 Step 17 |
| §14 database (49 tables) | 03 (superset, column-level) |
| §15 security & quality | 08 · 11 §4 (CI) |
| §16 development process | 07 · 10 |
| §17 folder structure | BUILD-PLAN §4 |
| §18 final recommendations | 00 decision log · 01 principles |
| Hindi/English | 01 §2 · 05 (i18n) · 11 §3 |
| ONDC-ready | 01 §5.2 · 02 §6 port pattern |

**Result: every legacy requirement is mapped; none dropped.**

## 8. Module isolation & microservice extraction (summary)

Full strategy in `02` §10; per-module extraction notes in `12-module-build-cards.md`.

