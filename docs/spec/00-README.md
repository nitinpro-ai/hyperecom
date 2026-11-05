# ApnaCity — Specification Set

> **MASTER DOCUMENT:** `../COMPLETE-BUILD-GUIDE.md` — one self-contained,
> module-by-module build specification (all M01–M32 with tables/SQL, APIs, rules,
> screens, acceptance tests + master build sequence). **Share that one file.**
> This `docs/spec/` set is the extended reference behind it.
>
> Hyperlocal Multi-Vendor E-Commerce Marketplace
> The legacy root documents `legacy/concept.MD` and `legacy/implimentation.MD` are retained as
> historical input only. Where they conflict with this spec set, **this spec set wins.**

## Why this exists

The original documents correctly captured the business vision and most architectural
intuition, but they were prose briefs, not buildable specifications:

- No column-level data model (only table names).
- No formal order/payment/delivery state machines.
- No API contract.
- Two conflicting roadmaps.
- A corrupted ER diagram (`legacy/concept.MD` line 1160).
- Unresolved decisions (domain/TLS scheme, delivery ownership, cart model).

This spec set fixes all of that.

## Document index

| # | Document | Contents |
|---|----------|----------|
| 00 | `00-README.md` | This index, reading order, decision log |
| 01 | `01-vision-and-business.md` | Product vision, personas, journeys, scope, revenue model, answered business decisions |
| 02 | `02-architecture.md` | System context, tenancy, domain/TLS strategy, stack, repo structure, integration patterns |
| 03 | `03-data-model.md` | ER diagram, column-level tables, enums, indexes, tenancy & audit rules |
| 04 | `04-api-contract.md` | API conventions, error envelope, auth model, endpoint inventory, versioning |
| 05 | `05-module-catalogue.md` | Every backend + frontend module: responsibility, APIs, entities, events, tests |
| 06 | `06-state-machines.md` | Order, payment, delivery, return, listing, KYC state machines with role×transition matrices |
| 07 | `07-roadmap-and-sprints.md` | Phases, sprints, acceptance criteria, team shape, risk register |
| 08 | `08-security-compliance.md` | RBAC matrix, tenant isolation, India compliance (GST/DLT/DPDP/RBI), security checklist |
| 09 | `09-nfr-and-ops.md` | Performance targets, environments, observability, backup/DR, release process |
| 10 | `10-build-sequence.md` | **Step-by-step build: Steps 0–18 with Do/Verify** — the "start here to code" doc |
| 11 | `11-appendix.md` | Checkout/payment sequence, worked ledger example, notification templates (DLT), CI pipeline, env vars, geo data sources, legacy coverage matrix |
| 12 | `12-module-build-cards.md` | **32 independently buildable module cards** (self-contained work orders) + dependency graph + safe build order |

Related: [`../adr/000-template.md`](../adr/000-template.md) — architecture decision records template.

## Recommended reading order

0. **New here? → [`../START-HERE.md`](../START-HERE.md) — the development entry point** (where to start, current state, next action)
1. **First pass (decide):** `01` → `02` → `07`
2. **Before coding (start here):** `10` (Steps 0–4) with `03` → `04` → `08`
3. **During each build step:** `12` (module cards for that step) + `05` + `06`
4. **Money & flows:** `11` §1–2 with `06` §1–3
5. **Before pilot launch:** `09` + `08` compliance checklist

## Decision log

| ID | Decision | Status | Choice |
|----|----------|--------|--------|
| D-001 | Architecture style | **LOCKED** | Multi-tenant modular monolith (NestJS), single DB |
| D-002 | Catalogue model | **LOCKED** | Master product + variants shared; per-shop seller listings |
| D-003 | Order model | **LOCKED** | Parent order → seller child orders → items with price snapshot |
| D-004 | Multi-shop cart | **LOCKED (assumed)** | Yes — one cart, one payment, split into child orders |
| D-005 | Delivery ownership | **LOCKED (assumed)** | Both: ApnaCity riders *and* seller self-delivery (+ 3PL adapter later) |
| D-006 | Seller eligibility | **LOCKED (assumed)** | Any local shopkeeper after KYC verification |
| D-007 | Pilot city / scope | **LOCKED (assumed)** | Bijnor, UP — all general retail categories |
| D-008 | Legal entity | **LOCKED (assumed)** | India-based company operating in India |
| D-009 | Domain scheme | **PROPOSED — confirm before Phase 1** | `shop.apnacity.com` (single-level). See `02` §3 for alternatives |
| D-010 | Search engine | **LOCKED** | Postgres FTS + `pg_trgm` first; OpenSearch behind `SearchPort` from Phase 4 |
| D-011 | Mobile stack | **LOCKED** | React Native + Expo + EAS, 3 apps sharing `packages/*` |
| D-012 | Payments | **PROPOSED** | Cashfree (Easy Split) primary, Razorpay fallback, behind `PaymentProviderPort` |
| D-013 | Finance | **LOCKED** | Double-entry immutable ledger; never derive balances from order status |
| D-014 | Inventory | **LOCKED** | Atomic conditional stock + reservations with TTL; Redis never authoritative |
| D-015 | Module packaging | **LOCKED** | Every module is self-contained + microservice-extractable via ports/events (see `02` §10, `12`) |

> Items marked *assumed* were unresolved in the legacy docs. They are recorded here as
> defaults so development is not blocked. Change them only via an update to this table
> **and** a corresponding impact note in `02`/`03`.

## How to consume this with an AI coding agent

- **Building a module:** say `Build M<NN>` (e.g. "Build M09"). Load **only** that
  card from `12` + the spec slices it lists in *Refs* + its *Prerequisites*
  already built. The card is self-contained — no other context needed.
- **Building in order:** follow `10` Steps 0–18; each step lists its modules and
  a **Verify** gate that must pass before the next step.
- **Module change later:** because of D-015 isolation (ports + events only), a
  modification to one module never touches others; extraction to a standalone
  microservice follows the playbook in `02` §10.3.
- Enforce the Definition of Done in `07` §6 for every merged PR.
- Any schema change must land in `03` in the same PR as the code.
- Any new endpoint must land in `04` in the same PR as the code.
