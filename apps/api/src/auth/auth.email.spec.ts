import { describe, expect, it, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { uniquePhone } from "../test-utils";
import { AuthService } from "./auth.service";
import { RefreshFamilyService, InMemoryRefreshStore } from "./refresh-family.service";
import { InMemoryOtpStore } from "./otp.store";
import { ConsoleSmsPort } from "./sms.port";

/**
 * M01 email+mobile registration (integration, live DB). Register creates a user
 * with email + scrypt passwordHash + mobile + CUSTOMER role and returns tokens;
 * login verifies the password; duplicate email/phone are rejected with typed
 * reasons. Runs only when DATABASE_URL is set (shared cluster DB).
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const PEPPER = "test-pepper";
const SECRET = "test-jwt-secret-0123456789";
const TAG = "zz-email-auth";

function svc() {
  return new AuthService(
    new RefreshFamilyService(new InMemoryRefreshStore()),
    new InMemoryOtpStore(),
    new ConsoleSmsPort(),
    PEPPER,
    SECRET,
  );
}

const emails: string[] = [];
function uniqueEmail() {
  const e = `${TAG}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@dev.local`;
  emails.push(e);
  return e;
}

d("M01 email registration (integration)", () => {
  afterAll(async () => {
    if (!RUN) return;
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it("registers with email + mobile, attaches CUSTOMER role, returns tokens", async () => {
    const email = uniqueEmail();
    const phone = uniquePhone();
    const r = await svc().registerEmail({ email, phone, password: "hunter2password", name: "Test Buyer" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tokens.accessToken).toBeTruthy();
    expect(r.tokens.user.roles).toContain("CUSTOMER");

    const row = await prisma.user.findUnique({ where: { email } });
    expect(row?.phone).toBe(phone);
    expect(row?.passwordHash).toMatch(/^scrypt\$/);
    expect(row?.passwordHash).not.toContain("hunter2password"); // hashed, not plain
  });

  it("logs in with the right password and rejects the wrong one", async () => {
    const email = uniqueEmail();
    const phone = uniquePhone();
    await svc().registerEmail({ email, phone, password: "correct-horse-battery", name: "Login Test" });

    const ok = await svc().loginEmail({ email, password: "correct-horse-battery" });
    expect(ok.ok).toBe(true);

    const bad = await svc().loginEmail({ email, password: "wrong-password" });
    expect(bad).toEqual({ ok: false, reason: "WRONG_PASSWORD" });

    const missing = await svc().loginEmail({ email: uniqueEmail(), password: "x" });
    expect(missing).toEqual({ ok: false, reason: "NO_USER" });
  });

  it("rejects duplicate email and duplicate phone with typed reasons", async () => {
    const email = uniqueEmail();
    const phone = uniquePhone();
    const first = await svc().registerEmail({ email, phone, password: "password-one-two", name: "Dup" });
    expect(first.ok).toBe(true);

    const dupEmail = await svc().registerEmail({ email, phone: uniquePhone(), password: "password-one-two", name: "Dup" });
    expect(dupEmail).toEqual({ ok: false, reason: "EMAIL_TAKEN" });

    const dupPhone = await svc().registerEmail({ email: uniqueEmail(), phone, password: "password-one-two", name: "Dup" });
    expect(dupPhone).toEqual({ ok: false, reason: "PHONE_TAKEN" });
  });
});
