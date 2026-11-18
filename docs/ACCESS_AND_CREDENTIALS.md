# 🌐 ApnaCity — Site Access & Demo Credentials Guide

> **Quick Reference:** Everything you need to open the live ApnaCity web portals, log in with pre-seeded demo accounts, register a new seller account, reset a password, or access backend services on the LAN cluster (`192.168.2.224`).
>
> *Prerequisite:* Ensure corporate VPN (e.g., SAP VPN) is **OFF** when accessing `192.168.2.x` LAN addresses.

---

## 1. Live Application URLs (Cluster NodePorts @ `192.168.2.224`)

| Application / Service | URL | Purpose |
|---|---|---|
| **Seller Studio Portal** | **http://192.168.2.224:30281** | Merchant console: seller signup, PAN/GST KYC, storefront creation, product & photo upload, stock & order fulfillment |
| **Seller Login / Password Reset** | **http://192.168.2.224:30281/login** | Sign in, 1-Click Demo Seller Login, Phone OTP login, and Forgot Password recovery |
| **Seller Registration & KYC** | **http://192.168.2.224:30281/register** | Atomic seller account + PAN/GST KYC registration (works **without** requiring a storefront) |
| **Customer Marketplace (Web)** | **http://192.168.2.224:30280** | City-first customer storefront, product search, multi-seller price comparison, cart & checkout |
| **Customer Login** | **http://192.168.2.224:30280/login** | Customer sign-in & signup |
| **Admin Portal** | **http://192.168.2.224:30282** | Platform admin console: KYC review queue, catalog match merge, finance & system health |
| **Backend REST API (Health)** | **http://192.168.2.224:30400/v1/health** | NestJS modular monolith API (`/v1/*`) |
| **Jenkins CI/CD Dashboard** | **http://192.168.2.224:32080/job/apnacity/** | Automated build, lint, typecheck, 240+ unit/integration tests, and Kubernetes rollout |

---

## 2. Demo User & Seller Credentials

Both demo accounts are pre-seeded in PostgreSQL (`infrastructure/seed-demo-accounts.ts`) and ready for immediate login:

### A. Demo Seller Account (Seller Studio Portal)
- **Portal URL:** http://192.168.2.224:30281/login
- **Email / Username:** `demo_seller@apnacity.dev`
- **Password:** `demo12345`
- **Mobile Phone:** `+919000000002`
- **Assigned Roles:** `CUSTOMER`, `SELLER_OWNER`
- **KYC Status:** `APPROVED` (PAN: `ABCDE1234F`)
- **Pre-configured Storefront:** `Demo Store` (`demo-store.apnacity.com`, City: **Bijnor**, Status: `ACTIVE`)
- **Quick Login Tip:** On `http://192.168.2.224:30281/login`, click the **"⚡ 1-Click Demo Seller Login"** button to sign in immediately without typing credentials.

### B. Demo Customer Account (Customer Marketplace)
- **Portal URL:** http://192.168.2.224:30280/login
- **Email / Username:** `demo_customer@apnacity.dev`
- **Password:** `demo12345`
- **Mobile Phone:** `+919000000001`
- **Assigned Roles:** `CUSTOMER`

---

## 3. Step-by-Step User Workflows

### Workflow 1: Register a Brand-New Seller (No Storefront Required)
1. Open **http://192.168.2.224:30281/register** (or click **"✨ New Seller"** / **"Complete Seller Registration →"** on `/login`).
2. **Step 1 — Account:** Enter Owner Name, Business Email, Mobile (`+91...` or 10-digit number), and Password (min 8 chars; use **Show/Hide** to verify).
3. **Step 2 — Business & KYC:**
   - Enter **Legal Entity Name** and **Public Display Name**.
   - Select **Business Constitution** (`INDIVIDUAL`, `PROPRIETORSHIP`, `PARTNERSHIP`, `LLP`, `PVT_LTD`).
   - Enter a 10-character **PAN** (or click **"Generate valid PAN"** to auto-fill a valid unique PAN like `ABCDE1234F`).
   - Keep **⚡ Instant Dev KYC Approval** checked.
   - Click **"Complete KYC & Continue →"**.
4. Your seller account is now **active (`APPROVED`) with `SELLER_OWNER` permissions**! Click **"🚀 Enter Seller Studio Dashboard →"** immediately (creating a storefront in Step 3 is completely optional and can be done anytime later).

### Workflow 2: Password Recovery (Forgot Password)
1. Open **http://192.168.2.224:30281/login** and click **"Forgot password?"** above the password field.
2. Enter your registered seller email and click **"Send Recovery Code →"**.
3. In the dev environment, the 6-digit recovery code is auto-filled for convenience. Enter your new password (min 8 chars) and click **"Reset Password & Sign In →"**.

### Workflow 3: Publish a Product with Photos & Live Stock
1. Sign in to **http://192.168.2.224:30281** and click **"+ Add Product"** (`http://192.168.2.224:30281/products/new`).
2. Select your **Storefront** and **Marketplace Category**.
3. Under **📸 Product Pictures**, either:
   - Click **"📤 Upload Photo from Device"** to upload a JPG/PNG/WebP image from your computer or phone,
   - Paste an image URL and click **"+ Add URL"**, or
   - Click any of the **Quick sample photos** (`🥫 Grocery`, `🍬 Sweets`, `📱 Electronics`, `👗 Fashion`, `🏠 Home`).
4. Set **MRP (₹)**, **Selling Price (₹)**, and **Initial Stock** (e.g., `25`), then click **"🚀 Publish Product Live Now"**.

---

## 4. Infrastructure & Database Access (Dev Cluster)

| Component | Endpoint / Connection | Credentials / Notes |
|---|---|---|
| **PostgreSQL 16 + PostGIS** | `192.168.2.224:30432` (DB: `apnacity`) | User: `apnacity` / Pass: `apnacity` (`postgresql://apnacity:apnacity@192.168.2.224:30432/apnacity`) |
| **Redis** | `redis.apnacity.svc.cluster.local:6379` | In-cluster service |
| **Kubernetes Cluster** | `192.168.2.224` (namespace `apnacity`) | Kubeconfig: `~/work/homelab/kubeconfig/ubuntu-test.yaml` |
| **Re-seed Demo Accounts** | Run from `/Users/D073341/work/hyperecom` | `DATABASE_URL=postgresql://apnacity:apnacity@192.168.2.224:30432/apnacity pnpm --filter @apnacity/db exec tsx ../../infrastructure/seed-demo-accounts.ts` |
