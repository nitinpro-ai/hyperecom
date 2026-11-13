import { describe, expect, it } from "vitest";
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  checkOtp,
  hashPassword,
  verifyPassword,
  signAccess,
  verifyAccess,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  type OtpRecord,
} from "./auth.crypto";

const PEPPER = "test-pepper";
const SECRET = "test-jwt-secret";

describe("auth.crypto — OTP", () => {
  it("generates a 6-digit numeric OTP", () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    }
  });

  it("hash verifies the correct OTP and rejects a wrong one", () => {
    const salt = "s1";
    const h = hashOtp("123456", salt, PEPPER);
    expect(verifyOtpHash("123456", salt, PEPPER, h)).toBe(true);
    expect(verifyOtpHash("000000", salt, PEPPER, h)).toBe(false);
  });

  const rec = (over: Partial<OtpRecord> = {}): OtpRecord => ({
    hash: hashOtp("123456", "s1", PEPPER),
    salt: "s1",
    attempts: 0,
    createdAt: 1000,
    ...over,
  });

  it("accepts correct OTP within TTL", () => {
    expect(checkOtp(rec(), "123456", PEPPER, 1000 + 1000).ok).toBe(true);
  });

  it("rejects an expired OTP", () => {
    const r = checkOtp(rec(), "123456", PEPPER, 1000 + OTP_TTL_MS + 1);
    expect(r).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("wrong OTP reports attempts left and locks after 5", () => {
    const r = checkOtp(rec({ attempts: 0 }), "999999", PEPPER, 2000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.attemptsLeft).toBe(OTP_MAX_ATTEMPTS - 1);

    const r5 = checkOtp(rec({ attempts: 4 }), "999999", PEPPER, 2000);
    if (!r5.ok) expect(r5.attemptsLeft).toBe(0);
  });

  it("respects an active lock", () => {
    const r = checkOtp(rec({ lockedUntil: 5000 }), "123456", PEPPER, 4000);
    expect(r).toEqual({ ok: false, reason: "LOCKED" });
  });
});

describe("auth.crypto — password", () => {
  it("round-trips a password and rejects the wrong one", () => {
    const stored = hashPassword("hunter2", PEPPER);
    expect(verifyPassword("hunter2", PEPPER, stored)).toBe(true);
    expect(verifyPassword("wrong", PEPPER, stored)).toBe(false);
  });
});

describe("auth.crypto — access JWT", () => {
  it("signs and verifies with correct claims", () => {
    const now = 1_000_000;
    const token = signAccess(
      { sub: "u1", roles: ["CUSTOMER"], cityId: "bijnor" },
      SECRET,
      now,
    );
    const r = verifyAccess(token, SECRET, now + 1000);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.claims.sub).toBe("u1");
      expect(r.claims.roles).toEqual(["CUSTOMER"]);
      expect(r.claims.cityId).toBe("bijnor");
    }
  });

  it("rejects a tampered signature", () => {
    const now = 1_000_000;
    const token = signAccess({ sub: "u1", roles: [] }, SECRET, now);
    const r = verifyAccess(token, "WRONG-SECRET", now + 1000);
    expect(r).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects an expired access token (15 min)", () => {
    const now = 1_000_000;
    const token = signAccess({ sub: "u1", roles: [] }, SECRET, now);
    const r = verifyAccess(token, SECRET, now + 15 * 60 * 1000 + 1);
    expect(r).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects a malformed token", () => {
    expect(verifyAccess("not.a.jwt.at.all", SECRET, 0).ok).toBe(false);
    expect(verifyAccess("garbage", SECRET, 0)).toEqual({ ok: false, reason: "MALFORMED" });
  });
});
