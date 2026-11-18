# 📚 ApnaCity — Master Documentation Index & Reference Map

> **Single Source of Truth for All Project Documentation.**
> Every architectural specification, operational guide, credential reference, build tracker, and module card in the `hyperecom` repository is indexed below.

---

## 1. Quick Access & Operations (Start Here)

| Document | Path | Description |
|---|---|---|
| **Site Access & Demo Credentials** | [`docs/ACCESS_AND_CREDENTIALS.md`](ACCESS_AND_CREDENTIALS.md) | **Live URLs (`:30280`, `:30281`, `:30282`, `:30400`), demo seller & customer usernames/passwords, and step-by-step user guides** |
| **Development Entry Point** | [`docs/START-HERE.md`](START-HERE.md) | Project onboarding guide, build sequence overview (Steps 0–18), and milestone roadmap |
| **Build & Module Progress Tracker** | [`docs/TRACKING.md`](TRACKING.md) | Detailed step-by-step completion log, test gates, and handoff tracker across all 32 modules |
| **Seller Auth & Studio AI Progress** | [`docs/AI_PROGRESS.md`](AI_PROGRESS.md) | Root-cause analysis, architectural decisions, fixes, and E2E test results for Seller Registration, Auth & Studio |
| **Kubernetes Dev Cluster Guide** | [`infrastructure/CLUSTER.md`](../infrastructure/CLUSTER.md) | MicroK8s cluster topology (`192.168.2.224`), NodePorts, Docker image build scripts, and day-2 kubectl operations |
| **Local Development Setup** | [`DEVELOPMENT.md`](../DEVELOPMENT.md) | Toolchain prerequisites (Node, pnpm, Turborepo, Prisma) and local workspace commands |
| **Repository Overview** | [`README.md`](../README.md) | High-level project summary, monorepo directory layout, and tech stack |

---

## 2. Master Architecture & Product Specifications

| Document | Path | Description |
|---|---|---|
| **Master Complete Build Guide** | [`docs/COMPLETE-BUILD-GUIDE.md`](COMPLETE-BUILD-GUIDE.md) | **The 32-Module Master Specification**: end-to-end workflows, SQL schemas, REST APIs, business rules, and Steps 0–18 |
| **Executive Build Plan** | [`docs/BUILD-PLAN.md`](BUILD-PLAN.md) | Condensed architecture overview, stack choices, key design decisions, and delivery phases |
| **UI/UX Wireframes** | [`docs/WIREFRAMES.md`](WIREFRAMES.md) | Screen layouts and user flows across Customer Web, Seller Studio Portal, Admin Console, and Mobile apps |

---

## 3. Detailed Reference Specifications (`docs/spec/00–12`)

| Spec # | Document | Path | Scope |
|---|---|---|---|
| **00** | **Spec Index & Decision Log** | [`docs/spec/00-README.md`](spec/00-README.md) | Index of all reference specs and architectural decision log (`D-001`–`D-016`) |
| **01** | **Vision & Business Model** | [`docs/spec/01-vision-and-business.md`](spec/01-vision-and-business.md) | City-first hyperlocal marketplace model, unit economics, and tenant isolation |
| **02** | **System Architecture** | [`docs/spec/02-architecture.md`](spec/02-architecture.md) | Modular monolith boundaries, outbox pattern, caching, and microservice extraction rules |
| **03** | **Data Model & ERD** | [`docs/spec/03-data-model.md`](spec/03-data-model.md) | PostgreSQL 16 + PostGIS + ltree + pg_trgm tables, constraints, and Row-Level Security (RLS) |
| **04** | **API Contract Standards** | [`docs/spec/04-api-contract.md`](spec/04-api-contract.md) | REST `/v1` conventions, error envelopes, idempotency keys, pagination, and OpenAPI client generation |
| **05** | **32-Module Catalogue** | [`docs/spec/05-module-catalogue.md`](spec/05-module-catalogue.md) | Ownership matrix, table boundaries, events, and dependencies for modules `M01`–`M32` |
| **06** | **State Machines** | [`docs/spec/06-state-machines.md`](spec/06-state-machines.md) | Formal state transitions for Seller KYC, Listings, Orders (`Order` / `SellerOrder`), Payments, and Returns |
| **07** | **Roadmap & Sprints** | [`docs/spec/07-roadmap-and-sprints.md`](spec/07-roadmap-and-sprints.md) | 40-week sprint breakdown and Bijnor pilot launch checklist |
| **08** | **Security & Compliance** | [`docs/spec/08-security-compliance.md`](spec/08-security-compliance.md) | JWT + refresh-token rotation/theft detection, RBAC, DPDP Act compliance, and GST/PAN rules |
| **09** | **NFRs & Operations** | [`docs/spec/09-nfr-and-ops.md`](spec/09-nfr-and-ops.md) | SLOs, observability (OpenTelemetry, Prometheus), backups, and disaster recovery |
| **10** | **Build Sequence** | [`docs/spec/10-build-sequence.md`](spec/00-README.md) | Detailed dependency order and verification gates for Steps 0–18 |
| **11** | **Appendix** | [`docs/spec/11-appendix.md`](spec/11-appendix.md) | Environment variables, external provider checklists, and glossary |
| **12** | **Module Build Cards** | [`docs/spec/12-module-build-cards.md`](spec/12-module-build-cards.md) | Standalone implementation prompts and acceptance criteria per module |

---

## 4. Feature & App Notes (`Mydocs/` & `docs/adr/` & `docs/legacy/`)

| Document | Path | Description |
|---|---|---|
| **Seller Portal & Onboarding Notes** | [`Mydocs/1-seller.MD`](../Mydocs/1-seller.MD) | Seller registration, authentication, onboarding, dashboard, and inventory checklist |
| **Mobile Apps Overview** | [`Mydocs/mobileapp/readme.MD`](../Mydocs/mobileapp/readme.MD) | Customer, Seller, and Rider mobile app notes |
| **ADR Template** | [`docs/adr/000-template.md`](adr/000-template.md) | Template for recording new Architecture Decision Records |
| **Legacy Concept Notes** | [`docs/legacy/concept.MD`](legacy/concept.MD) | Original business concept notes (historical reference, superseded by `COMPLETE-BUILD-GUIDE.md`) |
| **Legacy Implementation Notes** | [`docs/legacy/implimentation.MD`](legacy/implimentation.MD) | Original implementation sketch (historical reference) |
