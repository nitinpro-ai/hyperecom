# AI Progress Log — Seller Registration & Authentication Architecture

## 1. Architecture & Root-Cause Diagnosis

### Identified Issues
1. **Container Boot Crash (`apps/api/src/main.ts`)**:
   - Direct runtime import `import { json, urlencoded } from "express"` failed inside the pnpm container image (`Cannot find module 'express'`) because `express` is a transitive dependency of `@nestjs/platform-express`.
   - **Resolution**: Switched to `NestFactory.create<NestExpressApplication>(AppModule)` and `app.useBodyParser("json", { limit: "10mb" })` with a type-only import.
2. **Non-Atomic Seller Signup & Storefront Coupling**:
   - Previously, seller registration split user creation (`POST /v1/auth/register`) and seller KYC creation (`POST /v1/sellers/register`) across separate requests and pushed users into a mandatory Step 3 storefront screen.
   - If the second request failed (e.g., invalid PAN, duplicate PAN, or expired session), an orphaned `User` record remained in PostgreSQL without a `Seller` profile, causing subsequent retries with the same email/phone to fail with `409 Conflict` (`EMAIL_TAKEN` / `PHONE_TAKEN`).
   - **Resolution**:
     - Added atomic **`POST /v1/auth/seller-register`** (`AuthService.registerSellerAccount`) that validates all account + business/KYC fields upfront (`name`, `email`, `phone`, `password`, `legalName`, `displayName`, `businessType`, `pan`, optional `gstin`), checks duplicate `email`, `phone`, and `pan` (`PAN_TAKEN`), and executes a single `prisma.$transaction(...)` creating `User` + `UserRole (CUSTOMER, SELLER_OWNER)` + `Seller` + `OutboxEvent`s. Any failure rolls back the entire transaction cleanly.
     - Updated `SellersService.register` (`POST /v1/sellers/register`) to normalize PAN/GSTIN, prevent duplicate PAN (`PAN_TAKEN`), and support upgrading an existing user account into a seller account without requiring a storefront.
3. **Multi-Replica Session Refresh & Password Recovery**:
   - `deploy/api` runs multiple replicas with `InMemoryRefreshStore`. If `/v1/auth/refresh` hit a different pod than the one that issued the token family, refresh failed with `401`.
   - No password recovery endpoint or UI existed.
   - **Resolution**:
     - Added HMAC-signed stateless fallback verification in `AuthService` for multi-replica refresh and password reset tokens, while preserving stateful `RefreshFamilyService` rotation and reuse/theft revocation.
     - Added `POST /v1/auth/password-reset/request` and `POST /v1/auth/password-reset/confirm`.
4. **UI/UX & Accessibility (`apps/seller-portal`)**:
   - Redesigned `/login` and `/register` with mobile-first responsive layouts, accessible form controls (`aria-invalid`, `aria-describedby`, `role="alert"`), show/hide password toggles, password strength meter, real-time validation, password recovery flow, and standalone seller registration that completes **without requiring a storefront**.

## 2. Implementation Status
- [x] Fix `apps/api/src/main.ts` body parser configuration without direct `express` runtime import
- [x] Implement atomic `POST /v1/auth/seller-register`, password reset endpoints (`POST /v1/auth/password-reset/request` & `/confirm`), and multi-replica refresh fallback in `apps/api/src/auth/*` and `apps/api/src/sellers/*`
- [x] Update `packages/api-client/src/index.ts` and `apps/seller-portal/src/lib/session.ts`
- [x] Redesign `apps/seller-portal/src/app/login/page.tsx` and `apps/seller-portal/src/app/register/page.tsx`
- [x] Execute unit, integration, and E2E tests + desktop/mobile viewport verification

## 3. Test & Verification Summary (`PASS`)
- **Typecheck (`pnpm typecheck`)**: `18/18` tasks passed (`0` errors).
- **Unit & Integration Tests (`vitest run`)**: `6/6` test suites (`39/39` tests) passed against live PostgreSQL (`192.168.2.224:30432`), including `src/auth/seller-auth.integration.spec.ts` (atomic seller registration without storefront, invalid input rejection, duplicate email/phone/PAN prevention with zero orphaned rows, cross-replica session refresh, password recovery, and logout revocation).
- **Production Build (`pnpm --filter @apnacity/seller-portal build`)**: `8/8` static routes compiled and prerendered cleanly.
- **Live Cluster E2E (`http://192.168.2.224:30400` & `http://192.168.2.224:30281`)**:
  - `api` (`2/2` Running, `0` restarts) and `seller-portal` (`1/1` Running, `0` restarts).
  - Desktop & Mobile viewport HTTP 200 verification across `/login`, `/register`, `/`, `/products`, and `/products/new`.
  - Verified atomic seller registration without a storefront, duplicate prevention (`409`), protected route guards (`401`/`200`), token refresh, password reset, product photo upload/serving (`/v1/media/upload-base64` -> `/v1/media/raw/:id`), and logout (`204`).

