/**
 * Seed demo login accounts for testing (idempotent — safe to re-run).
 *
 *   demo_customer@apnacity.dev  — CUSTOMER, email+password login (web).
 *   demo_seller@apnacity.dev    — APPROVED seller WITH a shop in Bijnor,
 *                                 email+password login (seller portal).
 *
 * Password for BOTH is read from env DEMO_PASSWORD (default "demo12345").
 * The scrypt passwordHash MUST use the same pepper the running API uses
 * (OTP_HASH_PEPPER), so run this with that env injected from the cluster secret:
 *
 *   OTP_HASH_PEPPER=<from secret> DATABASE_URL=postgresql://...:30432/apnacity \
 *     tsx infrastructure/seed-demo-accounts.ts
 *
 * Prints the final credentials table (email + password) so the tester has them.
 */
import { prisma } from "@apnacity/db";
import { hashPassword } from "../apps/api/src/auth/auth.crypto";

const PEPPER = process.env.OTP_HASH_PEPPER ?? process.env.AUTH_PEPPER ?? "dev-cluster-otp-pepper-change-me-32ch";
const PASSWORD = process.env.DEMO_PASSWORD ?? "demo12345";

const CUSTOMER = { email: "demo_customer@apnacity.dev", phone: "+919000000001", name: "Demo Customer" };
const SELLER = { email: "demo_seller@apnacity.dev", phone: "+919000000002", name: "Demo Seller" };

async function ensureUser(spec: { email: string; phone: string; name: string }, roleName: string) {
  const passwordHash = hashPassword(PASSWORD, PEPPER);
  // Upsert by email; also (re)set password so re-runs refresh it to the known value.
  const user = await prisma.user.upsert({
    where: { email: spec.email },
    update: { passwordHash, name: spec.name, status: "ACTIVE" },
    create: { email: spec.email, phone: spec.phone, name: spec.name, passwordHash },
  });
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (role) {
    const existing = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id } });
    if (!existing) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  }
  return user;
}

async function main() {
  // 1) demo_customer
  const customer = await ensureUser(CUSTOMER, "CUSTOMER");

  // 2) demo_seller — user + CUSTOMER + SELLER_OWNER roles + APPROVED seller + shop
  const sellerUser = await ensureUser(SELLER, "CUSTOMER");
  await ensureUser(SELLER, "SELLER_OWNER");
  let seller = await prisma.seller.findUnique({ where: { userId: sellerUser.id } });
  if (!seller) {
    seller = await prisma.seller.create({
      data: {
        userId: sellerUser.id,
        legalName: "Demo Seller Pvt Ltd",
        displayName: "Demo Store",
        businessType: "INDIVIDUAL",
        pan: "ABCDE1234F",
        status: "APPROVED",
        kycSubmittedAt: new Date(),
      },
    });
  } else if (seller.status !== "APPROVED") {
    seller = await prisma.seller.update({ where: { id: seller.id }, data: { status: "APPROVED" } });
  }

  // a shop in Bijnor (first city), ACTIVE, slug demo-store
  const city = await prisma.city.findFirstOrThrow({ where: { slug: "bijnor" } });
  let shop = await prisma.shop.findFirst({ where: { sellerId: seller.id } });
  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        sellerId: seller.id,
        cityId: city.id,
        name: "Demo Store",
        slug: "demo-store",
        status: "ACTIVE",
      },
    });
  }

  console.log("\n=== Demo accounts ready (idempotent) ===");
  console.table([
    { role: "CUSTOMER (web)", email: CUSTOMER.email, password: PASSWORD, extra: `userId=${customer.id}` },
    { role: "SELLER (portal)", email: SELLER.email, password: PASSWORD, extra: `APPROVED, shop=${shop.slug}` },
  ]);
  console.log("Web login:    http://192.168.2.224:30280/login  (Email tab)");
  console.log("Seller login: http://192.168.2.224:30281/login  (Email tab)\n");
}

main()
  .catch((e) => { console.error("SEED_FAILED:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
