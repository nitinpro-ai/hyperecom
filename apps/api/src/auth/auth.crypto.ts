import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * M01 auth — pure primitives. No Redis/DB here so the security LOGIC (OTP
 * lifecycle, lockout, JWT claims, refresh-family rotation + reuse detection)
 * is fully unit-testable. The Redis/DB wiring lives in auth.service.ts.
 *
 * NOTE: spec calls for argon2id password hashing + a JWT library. To avoid new
 * runtime deps (Docker installs run with --ignore-scripts) this interim uses
 * node:crypto scrypt + HMAC-SHA256. Swap points are marked SWAP: argon2id / jose.
 */

// ---- OTP ------------------------------------------------------------------

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 min
export const OTP_MAX_ATTEMPTS = 5; // 5 wrong → lock
export const OTP_LOCK_MS = 15 * 60 * 1000; // 15 min
export const OTP_RESEND_MS = 60 * 1000; // 60 s

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Hash an OTP with a per-record salt + server pepper. SWAP: argon2id. */
export function hashOtp(otp: string, salt: string, pepper: string): string {
  return scryptSync(`${otp}:${pepper}`, salt, 32).toString("hex");
}

export function verifyOtpHash(otp: string, salt: string, pepper: string, hash: string): boolean {
  const a = Buffer.from(hashOtp(otp, salt, pepper), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface OtpRecord {
  hash: string;
  salt: string;
  attempts: number;
  createdAt: number;
  lockedUntil?: number;
}

export type OtpCheck =
  | { ok: true }
  | { ok: false; reason: "LOCKED" | "EXPIRED" | "WRONG"; attemptsLeft?: number };

/** Pure OTP verification against a record + current clock. */
export function checkOtp(
  rec: OtpRecord,
  otp: string,
  pepper: string,
  now: number,
): OtpCheck {
  if (rec.lockedUntil && now < rec.lockedUntil) return { ok: false, reason: "LOCKED" };
  if (now - rec.createdAt > OTP_TTL_MS) return { ok: false, reason: "EXPIRED" };
  if (verifyOtpHash(otp, rec.salt, pepper, rec.hash)) return { ok: true };
  const attemptsLeft = Math.max(0, OTP_MAX_ATTEMPTS - (rec.attempts + 1));
  return { ok: false, reason: "WRONG", attemptsLeft };
}

// ---- Password (optional) --------------------------------------------------

export function hashPassword(pw: string, pepper: string): string {
  const salt = randomBytes(16).toString("hex");
  const h = scryptSync(`${pw}:${pepper}`, salt, 32).toString("hex");
  return `scrypt$${salt}$${h}`; // SWAP: argon2id
}

export function verifyPassword(pw: string, pepper: string, stored: string): boolean {
  const [, salt, h] = stored.split("$");
  if (!salt || !h) return false;
  const calc = scryptSync(`${pw}:${pepper}`, salt, 32).toString("hex");
  const a = Buffer.from(calc, "hex");
  const b = Buffer.from(h, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- JWT (HMAC-SHA256) ----------------------------------------------------

export const ACCESS_TTL_MS = 15 * 60 * 1000; // 15 min

export interface AccessClaims {
  sub: string;
  roles: string[];
  shopId?: string;
  cityId?: string;
  iat: number;
  exp: number;
}

const b64u = (b: Buffer | string) =>
  Buffer.from(b).toString("base64url");

/** Mint an access JWT. SWAP: jose/jsonwebtoken + RS256 (public-key verify). */
export function signAccess(
  claims: Omit<AccessClaims, "iat" | "exp">,
  secret: string,
  now: number,
  ttlMs: number = ACCESS_TTL_MS,
): string {
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64u(
    JSON.stringify({ ...claims, iat: now, exp: now + ttlMs }),
  );
  const sig = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export type VerifyResult =
  | { ok: true; claims: AccessClaims }
  | { ok: false; reason: "BAD_SIGNATURE" | "EXPIRED" | "MALFORMED" };

export function verifyAccess(token: string, secret: string, now: number): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "MALFORMED" };
  const [header, payload, sig] = parts as [string, string, string];
  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }
  let claims: AccessClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }
  if (now >= claims.exp) return { ok: false, reason: "EXPIRED" };
  return { ok: true, claims };
}

// ---- Refresh token family (rotation + theft detection) --------------------

export function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function newFamilyId(): string {
  return randomBytes(16).toString("hex");
}
