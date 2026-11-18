import { describe, expect, it, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { AuthService } from "./auth.service";
import { RefreshFamilyService, InMemoryRefreshStore } from "./refresh-family.service";
import { InMemoryOtpStore } from "./otp.store";
import { ConsoleSmsPort } from "./sms.port";
import { SellersService } from "../sellers/sellers.service";
import { verifyAccess } from "./auth.crypto";

const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-seller-auth-spec";
const PEPPER = "test-pepper-seller-auth";
const SECRET = "test-jwt-secret-seller-auth-32ch";

function randomPan(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pickL = (n: number) =>
    Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  const pickD = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
  return `${pickL(5)}${pickD(4)}${pickL(1)}`;
}

d("Seller Registration & Authentication (integration)", () => {
  const auth = new AuthService(
    new RefreshFamilyService(new InMemoryRefreshStore()),
    new InMemoryOtpStore(),
    new ConsoleSmsPort(),
    PEPPER,
    SECRET,
  );
  const authReplica2 = new AuthService(
    new RefreshFamilyService(new InMemoryRefreshStore()),
    new InMemoryOtpStore(),
    new ConsoleSmsPort(),
    PEPPER,
    SECRET,
  );
  const sellers = new SellersService();

  const ts = Date.now();
  const email1 = `seller.atomic.${ts}@apnacity.dev`;
  const phone1 = `+9197${String(ts % 100000000).padStart(8, "0")}`;
  const pan1 = randomPan();

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { OR: [{ name: { startsWith: TAG } }, { email: { contains: `.${ts}@apnacity.dev` } }] },
      select: { id: true },
    });
    const uids = users.map((u) => u.id);
    if (uids.length > 0) {
      const sellerRows = await prisma.seller.findMany({
        where: { userId: { in: uids } },
        select: { id: true },
      });
      const sids = sellerRows.map((s) => s.id);
      await prisma.$transaction([
        prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [...uids, ...sids] } } }),
        prisma.seller.deleteMany({ where: { id: { in: sids } } }),
        prisma.userRole.deleteMany({ where: { userId: { in: uids } } }),
        prisma.user.deleteMany({ where: { id: { in: uids } } }),
      ]);
    }
    await prisma.$disconnect();
  });

  it("rejects invalid inputs (email, phone, weak password, PAN, GSTIN) without creating partial DB rows", async () => {
    const orphanEmail = `orphan.${ts}@apnacity.dev`;
    const orphanPhone = `+9196${String(ts % 100000000).padStart(8, "0")}`;

    expect(
      await auth.registerSellerAccount({
        name: `${TAG}-bad`,
        email: "not-an-email",
        phone: orphanPhone,
        password: "Password123!",
        legalName: "Test Legal",
        pan: randomPan(),
      }),
    ).toEqual({ ok: false, reason: "INVALID_EMAIL" });

    expect(
      await auth.registerSellerAccount({
        name: `${TAG}-bad`,
        email: orphanEmail,
        phone: "123",
        password: "Password123!",
        legalName: "Test Legal",
        pan: randomPan(),
      }),
    ).toEqual({ ok: false, reason: "INVALID_PHONE" });

    expect(
      await auth.registerSellerAccount({
        name: `${TAG}-bad`,
        email: orphanEmail,
        phone: orphanPhone,
        password: "short",
        legalName: "Test Legal",
        pan: randomPan(),
      }),
    ).toEqual({ ok: false, reason: "WEAK_PASSWORD" });

    expect(
      await auth.registerSellerAccount({
        name: `${TAG}-bad`,
        email: orphanEmail,
        phone: orphanPhone,
        password: "Password123!",
        legalName: "Test Legal",
        pan: "BADPAN123",
      }),
    ).toEqual({ ok: false, reason: "INVALID_PAN" });

    expect(
      await auth.registerSellerAccount({
        name: `${TAG}-bad`,
        email: orphanEmail,
        phone: orphanPhone,
        password: "Password123!",
        legalName: "Test Legal",
        pan: randomPan(),
        gstin: "BADGSTIN",
      }),
    ).toEqual({ ok: false, reason: "INVALID_GSTIN" });

    const orphanUser = await prisma.user.findUnique({ where: { email: orphanEmail } });
    expect(orphanUser).toBeNull();
  });

  it("atomically registers a seller WITHOUT a storefront, assigns SELLER_OWNER role, and persists User + Seller", async () => {
    const res = await auth.registerSellerAccount({
      name: `${TAG}-owner`,
      email: email1,
      phone: phone1,
      password: "StrongPassword123!",
      legalName: "Apna Kirana & Sons Pvt Ltd",
      displayName: "Apna Kirana",
      businessType: "PROPRIETORSHIP",
      pan: pan1,
      autoApproveDev: true,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.sellerStatus).toBe("APPROVED");
    expect(res.tokens.user.roles).toContain("SELLER_OWNER");
    expect(res.tokens.user.roles).toContain("CUSTOMER");

    const verified = verifyAccess(res.tokens.accessToken, SECRET, Date.now());
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.claims.roles).toContain("SELLER_OWNER");
    }

    const overview = await sellers.getOverview(res.tokens.user.id);
    expect(overview.seller).not.toBeNull();
    expect(overview.seller?.id).toBe(res.sellerId);
    expect(overview.seller?.pan).toBe(pan1);
    expect(overview.shops).toEqual([]);
  });

  it("prevents duplicate email, duplicate phone, and duplicate PAN with zero orphaned users", async () => {
    const newEmail = `dupcheck.${ts}@apnacity.dev`;
    const newPhone = `+9195${String(ts % 100000000).padStart(8, "0")}`;

    const dupEmail = await auth.registerSellerAccount({
      name: `${TAG}-dup1`,
      email: email1,
      phone: newPhone,
      password: "StrongPassword123!",
      legalName: "Another Legal",
      pan: randomPan(),
    });
    expect(dupEmail).toEqual({ ok: false, reason: "EMAIL_TAKEN" });

    const dupPhone = await auth.registerSellerAccount({
      name: `${TAG}-dup2`,
      email: newEmail,
      phone: phone1,
      password: "StrongPassword123!",
      legalName: "Another Legal",
      pan: randomPan(),
    });
    expect(dupPhone).toEqual({ ok: false, reason: "PHONE_TAKEN" });

    const dupPan = await auth.registerSellerAccount({
      name: `${TAG}-dup3`,
      email: newEmail,
      phone: newPhone,
      password: "StrongPassword123!",
      legalName: "Another Legal",
      pan: pan1,
    });
    expect(dupPan).toEqual({ ok: false, reason: "PAN_TAKEN" });

    const nonExistent = await prisma.user.findUnique({ where: { email: newEmail } });
    expect(nonExistent).toBeNull();
  });

  it("supports login, cross-replica session refresh, password recovery, and logout revocation", async () => {
    const badLogin = await auth.loginEmail({ email: email1, password: "WrongPassword999" });
    expect(badLogin).toEqual({ ok: false, reason: "WRONG_PASSWORD" });

    const goodLogin = await auth.loginEmail({ email: email1, password: "StrongPassword123!" });
    expect(goodLogin.ok).toBe(true);
    if (!goodLogin.ok) return;

    const crossRefresh = await authReplica2.refreshTokens(
      goodLogin.tokens.family,
      goodLogin.tokens.refreshToken,
    );
    expect(crossRefresh).not.toBeNull();
    expect(crossRefresh?.user.id).toBe(goodLogin.tokens.user.id);

    const resetReq = await auth.requestPasswordReset(email1);
    expect(resetReq.ok).toBe(true);
    if (!resetReq.ok) return;
    expect(resetReq.resetToken).toBeDefined();

    const resetConfirm = await authReplica2.confirmPasswordReset({
      email: email1,
      codeOrToken: resetReq.resetToken!,
      newPassword: "NewSecurePassword456!",
    });
    expect(resetConfirm.ok).toBe(true);

    expect((await auth.loginEmail({ email: email1, password: "StrongPassword123!" })).ok).toBe(false);
    const loginNew = await auth.loginEmail({ email: email1, password: "NewSecurePassword456!" });
    expect(loginNew.ok).toBe(true);
    if (!loginNew.ok) return;

    await auth.logout(loginNew.tokens.family);
    const afterLogout = await auth.refreshTokens(loginNew.tokens.family, loginNew.tokens.refreshToken);
    expect(afterLogout).toBeNull();
  });
});
