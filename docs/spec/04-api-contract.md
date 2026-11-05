# 04 — API Contract

## 1. Conventions

- Base: `https://api.apnacity.com/v1`
- JSON only; UTF-8; dates ISO-8601 UTC; money always integer **paise**.
- Auth: `Authorization: Bearer <access-jwt>` (15 min) + `POST /auth/refresh`
  (rotating refresh token, device-bound, revoke list in Redis).
- Tenant context: storefront calls send `X-Tenant-Slug` (validated HMAC
  `X-Tenant-Proof` set at edge); seller/admin APIs derive tenant from JWT claims.
- Idempotency: mutating POSTs accept `Idempotency-Key` header (UUID); stored
  24 h in `idempotency` module; replay returns original response.
- Pagination: keyset — `?after=<cursor>&limit=20` (max 100); response carries
  `nextCursor`.
- Rate limits (per user/IP): auth 5/min, search 30/min, writes 60/min, uploads
  10/min. `429` + `Retry-After`.

## 2. Error envelope

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 2 units left for 'Men's Cotton Shirt – M'",
    "details": [{"field": "cartItems[3].listingVariantId", "issue": "INSUFFICIENT_STOCK", "meta": {"available": 2}}],
    "traceId": "01J8Z…"
  }
}
```
HTTP status ⇄ code family: `400` validation, `401` unauthenticated, `403` forbidden
/ cross-tenant, `404` not found, `409` state conflict, `422` business rule,
`429` rate limit, `500` unexpected (masked, traceId only).

## 3. Endpoint inventory (summary — full Swagger generated from code)

### auth
`POST /auth/otp/request` · `POST /auth/otp/verify` · `POST /auth/password/login`
· `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me`

### geography
`GET /geo/states` · `GET /geo/cities?stateId` · `GET /geo/localities?cityId`
· `GET /geo/pincode/{pincode}` · `GET /geo/detect?lat&lng`

### catalog & listings (public)
`GET /search?q&cityId&category&brand&minPrice&maxPrice&sort&page-size`
· `GET /search/suggest?q` · `GET /products/{id}` · `GET /products/{id}/offers?cityId&variantId`
· `GET /categories` · `GET /brands`

### seller (JWT: SELLER_*)
`POST /sellers/register` · `POST /sellers/kyc/documents` · `GET /sellers/me`
· `POST /shops` (create shop → slug allocated) · `PATCH /shops/{shopId}`
· `POST /shops/{shopId}/listings` (wizard publish) ·
`PATCH /listings/{id}` · `POST /listings/bulk-import` (CSV) ·
`PATCH /listings/{id}/variants/{vid}` (price/stock quick edit) ·
`GET /shops/{shopId}/orders?status` · `POST /seller-orders/{id}/accept`
· `POST /seller-orders/{id}/reject` · `POST /seller-orders/{id}/ready`
· `GET /shops/{shopId}/payments` · `GET /shops/{shopId}/settlements`

### cart & checkout (JWT: CUSTOMER)
`GET /cart` · `POST /cart/items` · `PATCH /cart/items/{id}` · `DELETE /cart/items/{id}`
· `POST /checkout/quote` (fees, ETA, coupon) · `POST /checkout/coupons`
· `POST /checkout/payment-intent` · `POST /orders` (Idempotency-Key required)
· `GET /orders` · `GET /orders/{id}` · `POST /orders/{id}/cancel`
· `POST /orders/{id}/returns` · `GET /orders/{id}/tracking`

### payments (provider → platform)
`POST /webhooks/payments/{provider}` (signature + replay guard) ·
`POST /payments/{id}/refund` (admin/support)

### delivery (JWT: DELIVERY_PARTNER)
`GET /delivery/jobs?status=AVAILABLE|ASSIGNED` · `POST /delivery/jobs/{id}/accept`
· `POST /delivery/jobs/{id}/status` (picked_up/out_for_delivery/delivered/failed)
· `POST /delivery/jobs/{id}/otp-verify` · `POST /delivery/jobs/{id}/pod`
· `POST /delivery/partners/me/location` (batch GPS ping)
· `GET /delivery/partners/me/earnings`

### admin (JWT: *_ADMIN/SUPPORT)
`GET/POST /admin/shops/{id}/approve|suspend` · `GET /admin/sellers?kycStatus`
· `GET /admin/orders` · `POST /admin/orders/{id}/cancel`
· `GET /admin/settlements` · `POST /admin/settlements/run`
· `GET/PUT /admin/commissions` · `GET/PUT /admin/feature-flags`
· `GET /admin/audit-logs` · `GET /admin/analytics/*` · support ticket CRUD

### storefront (tenant-scoped, public)
`GET /storefront/resolve?host=` · `GET /storefront/{slug}` ·
`GET /storefront/{slug}/products` · `GET /storefront/{slug}/products/{productId}`

## 4. Versioning & compatibility

- URL version `/v1`; additive changes only within v1; breaking → `/v2` with
  6-month deprecation window and `Sunset` headers.
- OpenAPI spec generated from NestJS decorators on every CI build;
  `packages/api-client` regenerated and committed — CI fails if a PR changes
  the spec without regenerating the client.

## 5. Webhooks (outbound, Phase 5+)

Seller/system integrations subscribe to events (`order.child.accepted`,
`settlement.paid`) with HMAC-signed payloads, retries (1m/5m/30m/2h/6h) and
a management API (`GET/POST/DELETE /webhooks/subscriptions`).
