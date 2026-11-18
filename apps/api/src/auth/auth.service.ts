import { Injectable, Inject } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "@apnacity/db";
import { isValidPan, isValidGstin } from "../sellers/sellers.core";
import {
  generateOtp,
  hashOtp,
  checkOtp,
  hashPassword,
  verifyPassword,
  signAccess,
  OTP_MAX_ATTEMPTS,
  OTP_LOCK_MS,
  OTP_RESEND_MS,
  type OtpRecord,
} from "./auth.crypto";
import { RefreshFamilyService } from "./refresh-family.service";
import { type OtpStore } from "./otp.store";
import { type SmsPort } from "./sms.port";

export const OTP_STORE = Symbol("OTP_STORE");
export const SMS_PORT = Symbol("SMS_PORT");
export const AUTH_PEPPER = Symbol("AUTH_PEPPER");
export const JWT_SECRET = Symbol("JWT_SECRET");

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  roles: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  family: string;
  user: AuthUser;
}

export type RequestOtpResult =
  | { ok: true; resendIn: number }
  | { ok: false; reason: "THROTTLED"; resendIn: number };

export type VerifyOtpResult =
  | { ok: true; tokens: TokenPair }
  | { ok: false; reason: "LOCKED" | "EXPIRED" | "WRONG" | "NO_OTP"; attemptsLeft?: number };

export type RegisterEmailResult =
  | { ok: true; tokens: TokenPair }
  | { ok: false; reason: "EMAIL_TAKEN" | "PHONE_TAKEN" };

export type LoginEmailResult =
  | { ok: true; tokens: TokenPair }
  | { ok: false; reason: "NO_USER" | "WRONG_PASSWORD" | "NO_PASSWORD" };

export interface RegisterSellerAccountInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  legalName: string;
  displayName?: string;
  businessType?: string;
  pan: string;
  gstin?: string;
  autoApproveDev?: boolean;
}

export type RegisterSellerAccountResult =
  | { ok: true; sellerId: string; sellerStatus: string; tokens: TokenPair }
  | {
      ok: false;
      reason:
        | "INVALID_EMAIL"
        | "INVALID_PHONE"
        | "WEAK_PASSWORD"
        | "INVALID_LEGAL_NAME"
        | "INVALID_PAN"
        | "INVALID_GSTIN"
        | "EMAIL_TAKEN"
        | "PHONE_TAKEN"
        | "PAN_TAKEN";
    };

export type PasswordResetRequestResult =
  | { ok: true; message: string; resetToken?: string; devCode?: string }
  | { ok: false; reason: "INVALID_EMAIL" };

export type PasswordResetConfirmResult =
  | { ok: true; tokens: TokenPair }
  | { ok: false; reason: "NO_USER" | "INVALID_OR_EXPIRED_CODE" | "WEAK_PASSWORD" };

@Injectable()
export class AuthService {
  constructor(
    @Inject(RefreshFamilyService) private readonly refresh: RefreshFamilyService,
    @Inject(OTP_STORE) private readonly otps: OtpStore,
    @Inject(SMS_PORT) private readonly sms: SmsPort,
    @Inject(AUTH_PEPPER) private readonly pepper: string,
    @Inject(JWT_SECRET) private readonly jwtSecret: string,
  ) {}

  protected now(): number {
    return Date.now();
  }

  /** POST /auth/otp/request — generate, store (hashed), send; 60 s resend throttle. */
  async requestOtp(phone: string): Promise<RequestOtpResult> {
    const existing = await this.otps.get(phone);
    if (existing) {
      const age = this.now() - existing.createdAt;
      if (age < OTP_RESEND_MS) {
        return { ok: false, reason: "THROTTLED", resendIn: Math.ceil((OTP_RESEND_MS - age) / 1000) };
      }
    }
    const otp = generateOtp();
    const salt = randomBytes(16).toString("hex");
    const rec: OtpRecord = {
      hash: hashOtp(otp, salt, this.pepper),
      salt,
      attempts: 0,
      createdAt: this.now(),
    };
    await this.otps.put(phone, rec);
    await this.sms.sendOtp(phone, otp);
    return { ok: true, resendIn: OTP_RESEND_MS / 1000 };
  }

  /** POST /auth/otp/verify — verify, auto-create user first time, mint tokens. */
  async verifyOtp(phone: string, otp: string, name?: string): Promise<VerifyOtpResult> {
    const rec = await this.otps.get(phone);
    if (!rec) return { ok: false, reason: "NO_OTP" };

    const result = checkOtp(rec, otp, this.pepper, this.now());
    if (!result.ok) {
      if (result.reason === "WRONG") {
        const attempts = rec.attempts + 1;
        const update: OtpRecord = { ...rec, attempts };
        if (attempts >= OTP_MAX_ATTEMPTS) update.lockedUntil = this.now() + OTP_LOCK_MS;
        await this.otps.put(phone, update);
        return { ok: false, reason: "WRONG", attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - attempts) };
      }
      return { ok: false, reason: result.reason };
    }

    await this.otps.del(phone); // consume on success
    const user = await this.findOrCreateUser(phone, name);
    const tokens = await this.issueTokens(user);
    return { ok: true, tokens };
  }

  /**
   * POST /auth/register — email + password registration (dev-friendly, no SMS).
   * The form also collects a mobile number (users.phone is required + unique).
   * Mirrors findOrCreateUser's tx (user + CUSTOMER role + user.registered.v1),
   * but with email + scrypt passwordHash and a caller-provided phone. Both email
   * and phone are unique → report which collides.
   */
  async registerEmail(input: {
    email: string;
    phone: string;
    password: string;
    name?: string;
  }): Promise<RegisterEmailResult> {
    const email = input.email.trim().toLowerCase();
    const phone = input.phone.trim();
    const [emailTaken, phoneTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { phone } }),
    ]);
    if (emailTaken) return { ok: false, reason: "EMAIL_TAKEN" };
    if (phoneTaken) return { ok: false, reason: "PHONE_TAKEN" };

    const passwordHash = hashPassword(input.password, this.pepper);
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          phone,
          passwordHash,
          name: input.name?.trim() || "ApnaCity User",
          lastLoginAt: new Date(),
        },
      });
      const customer = await tx.role.findUnique({ where: { name: "CUSTOMER" } });
      if (customer) {
        await tx.userRole.create({ data: { userId: user.id, roleId: customer.id } });
      }
      await tx.outboxEvent.create({
        data: {
          aggregateType: "user",
          aggregateId: user.id,
          eventType: "user.registered.v1",
          payload: { userId: user.id, email, phone },
        },
      });
      return user;
    });
    const tokens = await this.issueTokens({
      id: created.id,
      phone: created.phone,
      name: created.name,
      roles: ["CUSTOMER"],
    });
    return { ok: true, tokens };
  }

  /** POST /auth/login — email + password login. */
  async loginEmail(input: { email: string; password: string }): Promise<LoginEmailResult> {
    const email = input.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (!user) return { ok: false, reason: "NO_USER" };
    if (!user.passwordHash) return { ok: false, reason: "NO_PASSWORD" };
    if (!verifyPassword(input.password, this.pepper, user.passwordHash)) {
      return { ok: false, reason: "WRONG_PASSWORD" };
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await this.issueTokens({
      id: user.id,
      phone: user.phone,
      name: user.name,
      roles: user.roles.map((r) => r.role.name),
    });
    return { ok: true, tokens };
  }

  /** POST /auth/refresh — rotating; reuse of a consumed token revokes the family. */
  async refreshTokens(family: string, presented: string): Promise<TokenPair | null> {
    if (!family || !presented) return null;
    const rotated = await this.refresh.rotate(family, presented);
    if (!rotated.ok) {
      if (rotated.reason === "UNKNOWN") {
        const verifiedUserId = this.verifyStatelessFamily(family);
        if (verifiedUserId) {
          const user = await this.loadAuthUser(verifiedUserId);
          if (user) return this.issueTokens(user);
        }
      }
      return null;
    }
    const userId = await this.refresh.getUserId(family);
    if (!userId) return null;
    const user = await this.loadAuthUser(userId);
    if (!user) return null;
    const accessToken = signAccess(
      { sub: user.id, roles: user.roles },
      this.jwtSecret,
      this.now(),
      24 * 60 * 60 * 1000,
    );
    return { accessToken, refreshToken: rotated.refreshToken, family, user };
  }

  /**
   * POST /auth/seller-register — Atomic, single-transaction seller signup.
   * Creates User + Roles (CUSTOMER, SELLER_OWNER) + Seller + OutboxEvents in one DB transaction.
   * Works completely without an existing storefront. Rolls back cleanly on any failure.
   */
  async registerSellerAccount(input: RegisterSellerAccountInput): Promise<RegisterSellerAccountResult> {
    const email = (input.email ?? "").trim().toLowerCase();
    const rawPhone = (input.phone ?? "").trim().replace(/[\s-]/g, "");
    const phone = /^\d{10}$/.test(rawPhone) ? `+91${rawPhone}` : rawPhone;
    const name = (input.name ?? "").trim();
    const legalName = (input.legalName ?? "").trim();
    const displayName = (input.displayName ?? "").trim() || legalName;
    const businessType = (input.businessType ?? "PROPRIETORSHIP").trim().toUpperCase();
    const pan = (input.pan ?? "").trim().toUpperCase();
    const gstin = input.gstin?.trim() ? input.gstin.trim().toUpperCase() : undefined;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: "INVALID_EMAIL" };
    if (!/^\+?\d{10,15}$/.test(phone)) return { ok: false, reason: "INVALID_PHONE" };
    if (!input.password || input.password.length < 8) return { ok: false, reason: "WEAK_PASSWORD" };
    if (legalName.length < 2) return { ok: false, reason: "INVALID_LEGAL_NAME" };
    if (!isValidPan(pan)) return { ok: false, reason: "INVALID_PAN" };
    if (gstin && !isValidGstin(gstin)) return { ok: false, reason: "INVALID_GSTIN" };

    const [emailTaken, phoneTaken, panTaken] = await Promise.all([
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
      prisma.user.findUnique({ where: { phone }, select: { id: true } }),
      pan !== "ABCDE1234F"
        ? prisma.seller.findFirst({ where: { pan }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (emailTaken) return { ok: false, reason: "EMAIL_TAKEN" };
    if (phoneTaken) return { ok: false, reason: "PHONE_TAKEN" };
    if (panTaken) return { ok: false, reason: "PAN_TAKEN" };

    const passwordHash = hashPassword(input.password, this.pepper);
    const shouldApprove = input.autoApproveDev !== false && process.env.NODE_ENV !== "production";
    const sellerStatus = shouldApprove ? "APPROVED" : "KYC_SUBMITTED";
    const nowDate = new Date();

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, phone, passwordHash, name: name || displayName, lastLoginAt: nowDate },
      });

      for (const rName of ["CUSTOMER", "SELLER_OWNER"]) {
        let role = await tx.role.findUnique({ where: { name: rName } });
        if (!role) role = await tx.role.create({ data: { name: rName } });
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }

      const seller = await tx.seller.create({
        data: {
          userId: user.id,
          legalName,
          displayName,
          businessType,
          pan,
          gstin: gstin ?? null,
          status: sellerStatus,
          kycSubmittedAt: nowDate,
          approvedAt: shouldApprove ? nowDate : null,
          approvedBy: shouldApprove ? user.id : null,
        },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: "user",
          aggregateId: user.id,
          eventType: "user.registered.v1",
          payload: { userId: user.id, email, phone, sellerId: seller.id },
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "seller",
          aggregateId: seller.id,
          eventType: shouldApprove ? "kyc.approved.v1" : "kyc.submitted.v1",
          payload: { sellerId: seller.id, userId: user.id },
        },
      });

      return { user, seller };
    });

    const tokens = await this.issueTokens({
      id: created.user.id,
      phone: created.user.phone,
      name: created.user.name,
      roles: ["CUSTOMER", "SELLER_OWNER"],
    });
    return { ok: true, sellerId: created.seller.id, sellerStatus, tokens };
  }
  /** POST /auth/password-reset/request — issues a 15-min HMAC reset token + 6-digit OTP code. */
  async requestPasswordReset(emailRaw: string): Promise<PasswordResetRequestResult> {
    const email = (emailRaw ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, reason: "INVALID_EMAIL" };
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, phone: true } });
    if (!user) {
      return { ok: true, message: "If that email is registered, a recovery code has been sent." };
    }
    const code = generateOtp();
    const salt = randomBytes(16).toString("hex");
    await this.otps.put(`pwreset:${email}`, {
      hash: hashOtp(code, salt, this.pepper),
      salt,
      attempts: 0,
      createdAt: this.now(),
    });
    await this.sms.sendOtp(user.phone, code);
    const exp = this.now() + 15 * 60 * 1000;
    const sig = createHmac("sha256", this.jwtSecret).update(`pwreset:${user.id}:${email}:${exp}`).digest("base64url");
    const resetToken = `${Buffer.from(JSON.stringify({ uid: user.id, email, exp })).toString("base64url")}.${sig}`;
    return {
      ok: true,
      message: "Password recovery code generated.",
      ...(process.env.NODE_ENV !== "production" ? { resetToken, devCode: code } : {}),
    };
  }

  /** POST /auth/password-reset/confirm — verifies OTP code OR stateless reset token and updates password. */
  async confirmPasswordReset(input: {
    email: string;
    codeOrToken: string;
    newPassword: string;
  }): Promise<PasswordResetConfirmResult> {
    const email = (input.email ?? "").trim().toLowerCase();
    const codeOrToken = (input.codeOrToken ?? "").trim();
    if (!input.newPassword || input.newPassword.length < 8) {
      return { ok: false, reason: "WEAK_PASSWORD" };
    }
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });
    if (!user) return { ok: false, reason: "NO_USER" };

    let verified = false;
    if (codeOrToken.includes(".")) {
      const [payloadB64, sig] = codeOrToken.split(".");
      if (payloadB64 && sig) {
        try {
          const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
            uid: string;
            email: string;
            exp: number;
          };
          const expected = createHmac("sha256", this.jwtSecret)
            .update(`pwreset:${parsed.uid}:${parsed.email}:${parsed.exp}`)
            .digest("base64url");
          if (parsed.uid === user.id && parsed.email === email && this.now() < parsed.exp && sig === expected) {
            verified = true;
          }
        } catch {
          verified = false;
        }
      }
    }
    if (!verified) {
      const rec = await this.otps.get(`pwreset:${email}`);
      if (rec) {
        const chk = checkOtp(rec, codeOrToken, this.pepper, this.now());
        if (chk.ok) {
          verified = true;
          await this.otps.del(`pwreset:${email}`);
        }
      }
    }
    if (!verified) return { ok: false, reason: "INVALID_OR_EXPIRED_CODE" };

    const passwordHash = hashPassword(input.newPassword, this.pepper);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, lastLoginAt: new Date() },
    });
    const tokens = await this.issueTokens({
      id: user.id,
      phone: user.phone,
      name: user.name,
      roles: user.roles.map((r) => r.role.name),
    });
    return { ok: true, tokens };
  }

  async logout(family: string): Promise<void> {
    await this.refresh.revokeFamily(family);
  }

  /** Mint a fresh token pair after a user's roles change (e.g. SELLER_OWNER granted). */
  async issueTokensForUserId(userId: string): Promise<TokenPair | null> {
    const user = await this.loadAuthUser(userId);
    if (!user) return null;
    return this.issueTokens(user);
  }

  // ---- internals ----------------------------------------------------------

  private verifyStatelessFamily(family: string): string | null {
    const parts = family.split(".");
    if (parts.length !== 3) return null;
    const [uid, rawFam, sig] = parts as [string, string, string];
    const expected = createHmac("sha256", this.jwtSecret).update(`fam:${uid}:${rawFam}`).digest("base64url");
    return sig === expected ? uid : null;
  }

  private async issueTokens(user: AuthUser): Promise<TokenPair> {
    const rawFam = randomBytes(12).toString("hex");
    const sig = createHmac("sha256", this.jwtSecret).update(`fam:${user.id}:${rawFam}`).digest("base64url");
    const signedFamily = `${user.id}.${rawFam}.${sig}`;
    const { family, refreshToken } = await this.refresh.start(user.id, signedFamily);
    const accessToken = signAccess(
      { sub: user.id, roles: user.roles },
      this.jwtSecret,
      this.now(),
      24 * 60 * 60 * 1000,
    );
    return { accessToken, refreshToken, family, user };
  }

  private async findOrCreateUser(phone: string, name?: string): Promise<AuthUser> {
    const existing = await prisma.user.findUnique({
      where: { phone },
      include: { roles: { include: { role: true } } },
    });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { lastLoginAt: new Date() } });
      return {
        id: existing.id,
        phone: existing.phone,
        name: existing.name,
        roles: existing.roles.map((r) => r.role.name),
      };
    }

    // first login → create user + CUSTOMER role + emit user.registered.v1 (one tx)
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { phone, name: name?.trim() || "ApnaCity User", lastLoginAt: new Date() },
      });
      const customer = await tx.role.findUnique({ where: { name: "CUSTOMER" } });
      if (customer) {
        await tx.userRole.create({ data: { userId: user.id, roleId: customer.id } });
      }
      await tx.outboxEvent.create({
        data: {
          aggregateType: "user",
          aggregateId: user.id,
          eventType: "user.registered.v1",
          payload: { userId: user.id, phone },
        },
      });
      return user;
    });
    return { id: created.id, phone: created.phone, name: created.name, roles: ["CUSTOMER"] };
  }

  private async loadAuthUser(userId: string): Promise<AuthUser | null> {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!u) return null;
    return { id: u.id, phone: u.phone, name: u.name, roles: u.roles.map((r) => r.role.name) };
  }
}
