# 06 — State Machines

Every status change: (1) validate transition against the matrix, (2) verify actor
role, (3) write `order_events`/status row + outbox in one transaction,
(4) side effects via event consumers only. Illegal transition ⇒ `409 CONFLICT`.

## 1. Parent order (`orders.status`)

```
PENDING_PAYMENT ──captured──► PLACED ──all children CLOSED──► COMPLETED
       │                        │
       └──failed/expired──► CANCELLED   └──all children cancelled──► CANCELLED
                                 └──some children cancelled──► PARTIALLY_CANCELLED
PARTIALLY_CANCELLED ──remaining children CLOSED──► COMPLETED
PARTIALLY_CANCELLED ──remaining children cancelled──► CANCELLED
```

| From | To | Allowed actor | Trigger |
|------|----|---------------|---------|
| PENDING_PAYMENT | PLACED | SYSTEM | payment.captured |
| PENDING_PAYMENT | CANCELLED | SYSTEM | payment failed / quote expiry (15 min) |
| PLACED | PARTIALLY_CANCELLED | SYSTEM | any child cancelled/rejected |
| PLACED | CANCELLED | CUSTOMER / ADMIN / SYSTEM | all children cancelled |
| PARTIALLY_CANCELLED | COMPLETED | SYSTEM | remaining children CLOSED |
| PARTIALLY_CANCELLED | CANCELLED | SYSTEM | remaining children cancelled |
| PLACED | COMPLETED | SYSTEM | all children CLOSED |

> COMPLETED only when every child is CLOSED (delivered + return window elapsed +
> ledger posted). Customer cancellations allowed at parent level only while **all**
> children ∈ {NEW, ACCEPTED}; item-level cancellation otherwise.

## 2. Seller child order (`seller_orders.status`)

```
NEW ──accept──► ACCEPTED ──► PREPARING ──► READY ──► DISPATCHED ──► OUT_FOR_DELIVERY
 │                │                                          │              │
 │ reject         │ cancel (policy)                          delivered      delivered
 ▼                ▼                                                          ▼
REJECTED       CANCELLED ──partial──► (items cancelled, order stays)     DELIVERED
                                                                            │
RETURN_REQUESTED ──► RETURNED ──► CLOSED ◄──return window elapsed─────────┘
NEW/ACCEPTED/PREPARING/READY ──timeout(10 min from NEW)──► REJECTED (auto)
```

| From | To | Actor | Guard / side effect |
|------|----|-------|---------------------|
| NEW | ACCEPTED | SELLER_OWNER, SELLER_STAFF | within `accept_deadline_at`; notify customer + create delivery job (or seller-self) |
| NEW | REJECTED | SELLER_*, SYSTEM(timeout) | reason required; release reservations; trigger refund for that child |
| ACCEPTED | PREPARING | SELLER_* | — |
| PREPARING | READY | SELLER_* | pack complete |
| READY | DISPATCHED | RIDER (pickup scan) / SELLER (self) | consume reservations (stock decrement) |
| DISPATCHED | OUT_FOR_DELIVERY | RIDER / SELLER | — |
| OUT_FOR_DELIVERY | DELIVERED | RIDER (OTP) / SELLER (self-confirm) | PoD recorded; notify customer |
| OUT_FOR_DELIVERY | FAILED | RIDER | failed_reason; retry ×2 → return-to-seller |
| NEW/ACCEPTED | CANCELLED | SELLER (pre-dispatch), CUSTOMER (pre-dispatch), ADMIN | refund if paid; release stock |
| DELIVERED | RETURN_REQUESTED | CUSTOMER | within window; return flow §4 |
| RETURN_REQUESTED | RETURNED | SYSTEM | pickup completed + inspection passed |
| DELIVERED / RETURNED | CLOSED | SYSTEM | return window elapsed & ledger posted |

Partial cancellation: items marked `CANCELLED`; child order stays live with
recomputed totals; parent → `PARTIALLY_CANCELLED`; refund scoped to cancelled items.

## 3. Payment (`payments.status`)

```
CREATED ──authorized──► AUTHORIZED ──captured──► CAPTURED ──refund──► PARTIALLY_REFUNDED ──► REFUNDED
   │                        │                        │
   └──failed──► FAILED      └──expired (15 min)──► FAILED   └──full refund──► REFUNDED
COD: CREATED ──(delivered + cash collected)──► CAPTURED ──recon mismatch──► manual review ticket
```
Webhook is the **only** capture authority; manual status edits forbidden.

## 4. Return (`return_requests.status`)

```
REQUESTED ──► APPROVED ──► PICKUP_SCHEDULED ──► PICKED_UP ──► RECEIVED ──► INSPECTION_PASSED
    │            │                                              │
    └─rejected──► REJECTED                                      └─failed──► INSPECTION_FAILED
INSPECTION_PASSED ──► REFUND_INITIATED ──► COMPLETED
REQUESTED ──cancel──► CANCELLED (customer, before pickup)
INSPECTION_FAILED ──► dispute → support ticket (frozen refund)
```

## 5. Listing (`seller_listings.status`)

```
DRAFT ──publish (validated)──► ACTIVE ──pause──► PAUSED ──resume──► ACTIVE
ACTIVE ──available=0 (auto)──► OUT_OF_STOCK ──restock──► ACTIVE
any ──shop suspended──► PAUSED (system)     DRAFT/REJECTED ──admin block──► REJECTED
```

## 6. Seller KYC (`sellers.status`)

```
DRAFT ──docs submitted──► KYC_PENDING ──admin approve──► APPROVED
KYC_PENDING ──admin reject──► REJECTED ──resubmit──► KYC_PENDING
APPROVED ──violation──► SUSPENDED ──reinstated──► APPROVED
```

## 7. Delivery job (`delivery_jobs.status`)

```
UNASSIGNED ──assigned──► ASSIGNED ──accept──► ACCEPTED ──arrive──► AT_PICKUP
─pick up──► PICKED_UP ──► IN_TRANSIT ──► AT_DROP ──OTP/PoD──► DELIVERED
ASSIGNED/ACCEPTED ──reject/timeout──► UNASSIGNED (next rider)
AT_DROP ──fail ×2──► FAILED ──► RETURNED_TO_SELLER
returns: RETURN_PICKUP mirrors the forward chain.
SELLER_SELF jobs: same statuses, transitions driven from seller portal.
```

## 8. Timer jobs (BullMQ `order-timers`)

| Timer | Default | Action |
|-------|---------|--------|
| quote/payment expiry | 15 min | parent → CANCELLED |
| seller accept deadline | 10 min | child → REJECTED (auto) + refund |
| reservation TTL | 30 min | release stock |
| assignment offer | 60 s | offer next rider |
| return window | per category (7 d) | child → CLOSED eligibility |
| ticket SLA | 2/8/24/48 h by priority | escalate |
