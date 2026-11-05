# 08 — Security & Compliance (India)

## 1. RBAC permission matrix (extract)

| Capability | SUPER_ADMIN | CITY_ADMIN | SELLER_OWNER | SELLER_STAFF | CUSTOMER | DELIVERY_PARTNER | SUPPORT |
|-----------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Approve sellers/shops | ✔ | ✔ (own city) | — | — | — | — | — |
| Manage taxonomy/commissions | ✔ | — | — | — | — | — | — |
| Create/edit own listings | — | — | ✔ | ✔ | — | — | — |
| Accept/reject orders | — | — | ✔ | ✔ | — | — | — |
| View settlements | ✔ | ✔ (city) | ✔ (own) | read | — | — | read |
| Cancel order | ✔ | ✔ | pre-dispatch | — | pre-dispatch | — | escalations |
| Initiate refund | ✔ | ✔ (≤ limit) | — | — | request only | — | ✔ (≤ limit) |
| Delivery job status | — | — | self-mode | — | track | ✔ (own) | view |
| Audit log search | ✔ | ✔ (city) | — | — | — | — | view |

Enforcement: NestJS policies + DB RLS (03 §14) + tenant-isolation test suite in CI.

## 2. Security requirements (implementation-level)

1. **Auth:** argon2id password hashing; OTP hashed, 5-attempt lockout; JWT 15 min;
   refresh rotation with reuse detection; session revocation list in Redis.
2. **Tenant isolation:** guards + RLS + isolation test suite; any 403/404 ambiguity
   resolved as 404 (no existence leak).
3. **Input:** Zod validation on every boundary; strict Prisma queries (no raw
   string interpolation); CSP, HSTS, X-Frame-Options DENY on all web apps.
4. **Uploads:** signed URLs only, MIME sniffing (content-based), size caps, EXIF
   strip, virus scan, private bucket for KYC docs with short-lived access links.
5. **Payments:** never store card/UPI credentials; webhook signature + timestamp
   window + replay table; refunds server-side only; payout release two-person rule.
6. **Secrets:** env vars validated by Zod at boot; no secrets in logs; rotation
   runbook; cloud secrets manager from Phase 5.
7. **Rate limits & abuse:** per-user and per-IP limits (04 §1); OTP pumping
   detection; COD risk gates; duplicate-account heuristics (device+phone).
8. **Audit:** every privileged mutation → `audit_logs` with before/after; audit
   tables append-only (REVOKE UPDATE/DELETE).
9. **Encryption:** TLS 1.2+ everywhere; at-rest via managed volumes; sensitive
   columns (PAN, bank) application-encrypted with envelope keys.
10. **Backups & DR:** RPO 15 min (PITR), RPO drill quarterly; RTO 1 h; secrets
    backed up separately.
11. **Dependencies:** lockfiles, weekly `pnpm audit`, Dependabot; CI blocks critical CVEs.
12. **Monitoring/alerting:** auth-failure spikes, 5xx rate, outbox DLQ, ledger
    imbalance alert (paged immediately).

## 3. India compliance checklist

| Area | Requirement | Where implemented |
|------|-------------|-------------------|
| GST | E-commerce operator (ECO) registration; TCS u/s 52 (0.5% intra / 1% inter) on **net** taxable value; invoice + B2C particulars | `finance` (TCS accrual config), `invoicing`; **professional CA advice mandatory before payouts go live** |
| E-invoice | IRN + QR for B2B where turnover thresholds apply | `invoicing` Phase 5 hooks |
| Consumer Protection (E-Commerce) Rules 2020 (+ amendments eff. 1 Jan 2027) | Seller legal name, address, grievance contact on listing/checkout; grievance officer + 30-day resolution; country-of-origin disclosure; no manipulative ranking parity clauses | `shops` display fields; `support` SLA; `content` policy pages |
| DPDP Act + Rules | Notice + consent at signup; purpose limitation; data minimisation; retention schedule; user rights (access/correction/erasure); breach notification | `users` consent records; `notifications` preferences; data-export + delete APIs (account deletion honors legal/financial retention) |
| RBI PA regulations | Payments only via RBI-licensed aggregator; settlement timelines; no funds pooling outside permitted arrangements | `payments`/`finance` via Cashfree split (no self-pooling) |
| DLT (SMS) | Registered sender ID + approved templates only | `notifications` DLT template registry (fail-closed) |
| FDI (if foreign investment later) | Marketplace model conditions: no inventory model, ≤ 25% single-seller sales, services parity rules | Business structure — legal advice; platform enforces single-seller share reporting |
| Labour (riders) | Gig-worker terms, insurance as applicable | Rider onboarding contracts (ops, not code) |

## 4. Data protection specifics

- PII fields inventory maintained in this doc; any new PII column requires spec update.
- Retention: order/financial records 8 years (GST); KYC docs 5 years post-closure;
  analytics raw events 13 months; deleted-account PII purged in 30 days except
  legally retained financial records (anonymised reference kept).
- Right-to-erasure endpoint queues a controlled purge job (financial rows keep,
  identity columns nulled).

## 5. Penetration test & go-live security gate

Before pilot launch: external pen test scope (auth, tenant isolation, payments
webhooks, upload pipeline, IDOR on all `/seller/*` and `/admin/*` routes);
fix all criticals/highs; retest; sign-off recorded in `docs/adr/`.
