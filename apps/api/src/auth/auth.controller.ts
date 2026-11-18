import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
  UseGuards,
  HttpException,
  Req,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { JwtAuthGuard, CurrentUser } from "./auth.guard";
import type { AccessClaims } from "./auth.crypto";

interface OtpRequestDto {
  phone: string;
}
interface OtpVerifyDto {
  phone: string;
  otp: string;
  name?: string;
}
interface RefreshDto {
  family: string;
  refreshToken: string;
}
interface RegisterEmailDto {
  email: string;
  phone: string;
  password: string;
  name?: string;
}
interface LoginEmailDto {
  email: string;
  password: string;
}
interface RegisterSellerAccountDto {
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
interface PasswordResetRequestDto {
  email: string;
}
interface PasswordResetConfirmDto {
  email: string;
  codeOrToken: string;
  newPassword: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{10,15}$/;

/** Fixed-window in-memory limiter (per process) for credential endpoints. SWAP: Redis for multi-replica. */
const WINDOW_MS = 60_000;
const MAX_HITS = 10;
const hits = new Map<string, { n: number; resetAt: number }>();
function throttle(key: string): void {
  const now = Date.now();
  if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  const h = hits.get(key);
  if (!h || h.resetAt <= now) {
    hits.set(key, { n: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (++h.n > MAX_HITS) {
    throw new HttpException({ error: "too_many_attempts", retryIn: Math.ceil((h.resetAt - now) / 1000) }, 429);
  }
}

/** M01 — /auth/* endpoints (spec M01 APIs). */
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("otp/request")
  @HttpCode(200)
  async requestOtp(@Body() dto: OtpRequestDto): Promise<{ resendIn: number }> {
    if (!/^\+?\d{10,15}$/.test(dto.phone ?? "")) {
      throw new HttpException("invalid phone", 400);
    }
    const r = await this.auth.requestOtp(dto.phone);
    if (!r.ok) throw new HttpException({ error: "throttled", resendIn: r.resendIn }, 429);
    return { resendIn: r.resendIn };
  }

  @Post("otp/verify")
  @HttpCode(200)
  async verifyOtp(@Body() dto: OtpVerifyDto) {
    const r = await this.auth.verifyOtp(dto.phone, dto.otp, dto.name);
    if (!r.ok) {
      if (r.reason === "LOCKED") throw new HttpException("account temporarily locked", 423);
      throw new UnauthorizedException({ error: r.reason, attemptsLeft: r.attemptsLeft });
    }
    return r.tokens;
  }

  @Post("register")
  @HttpCode(200)
  async register(@Body() dto: RegisterEmailDto, @Req() req: { ip?: string }) {
    throttle(`register:${req.ip}`);
    if (!EMAIL_RE.test(dto.email ?? "")) throw new HttpException("invalid email", 400);
    if (!PHONE_RE.test(dto.phone ?? "")) throw new HttpException("invalid mobile number", 400);
    if (!dto.password || dto.password.length < 8) {
      throw new HttpException("password must be at least 8 characters", 400);
    }
    const r = await this.auth.registerEmail(dto);
    if (!r.ok) {
      const msg = r.reason === "EMAIL_TAKEN" ? "email already registered" : "mobile number already registered";
      throw new HttpException({ error: r.reason, message: msg }, 409);
    }
    return r.tokens;
  }

  @Post("seller-register")
  @HttpCode(200)
  async registerSellerAccount(@Body() dto: RegisterSellerAccountDto, @Req() req: { ip?: string }) {
    throttle(`seller-register:${req.ip}`);
    const r = await this.auth.registerSellerAccount(dto);
    if (!r.ok) {
      const conflictReasons = new Set(["EMAIL_TAKEN", "PHONE_TAKEN", "PAN_TAKEN"]);
      const status = conflictReasons.has(r.reason) ? 409 : 400;
      const msgMap: Record<string, string> = {
        INVALID_EMAIL: "Please enter a valid email address.",
        INVALID_PHONE: "Please enter a valid 10-15 digit mobile number.",
        WEAK_PASSWORD: "Password must be at least 8 characters long.",
        INVALID_LEGAL_NAME: "Legal business name must be at least 2 characters.",
        INVALID_PAN: "Invalid PAN format. Expected 5 uppercase letters + 4 digits + 1 letter (e.g. ABCDE1234F).",
        INVALID_GSTIN: "Invalid GSTIN format. Expected 15-character GSTIN (e.g. 09ABCDE1234F1Z5).",
        EMAIL_TAKEN: "That email address is already registered. Please sign in instead.",
        PHONE_TAKEN: "That mobile number is already registered with another account.",
        PAN_TAKEN: "A seller account with this PAN is already registered.",
      };
      throw new HttpException({ error: r.reason, message: msgMap[r.reason] ?? r.reason }, status);
    }
    return { sellerId: r.sellerId, sellerStatus: r.sellerStatus, tokens: r.tokens };
  }

  @Post("password-reset/request")
  @HttpCode(200)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto, @Req() req: { ip?: string }) {
    throttle(`pwreset-req:${req.ip}`);
    const r = await this.auth.requestPasswordReset(dto.email);
    if (!r.ok) throw new HttpException({ error: r.reason, message: "Please enter a valid email address." }, 400);
    return r;
  }

  @Post("password-reset/confirm")
  @HttpCode(200)
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto, @Req() req: { ip?: string }) {
    throttle(`pwreset-confirm:${req.ip}`);
    const r = await this.auth.confirmPasswordReset(dto);
    if (!r.ok) {
      const status = r.reason === "WEAK_PASSWORD" ? 400 : 401;
      const msg =
        r.reason === "WEAK_PASSWORD"
          ? "New password must be at least 8 characters."
          : "Invalid or expired recovery code. Please request a new code.";
      throw new HttpException({ error: r.reason, message: msg }, status);
    }
    return r.tokens;
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginEmailDto, @Req() req: { ip?: string }) {
    throttle(`login:${req.ip}:${String(dto.email).toLowerCase()}`);
    if (!EMAIL_RE.test(dto.email ?? "")) throw new HttpException("invalid email", 400);
    const r = await this.auth.loginEmail(dto);
    if (!r.ok) throw new UnauthorizedException({ error: r.reason });
    return r.tokens;
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto) {
    const tokens = await this.auth.refreshTokens(dto.family, dto.refreshToken);
    if (!tokens) throw new UnauthorizedException("invalid or reused refresh token");
    return tokens;
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Body() dto: { family: string }): Promise<void> {
    await this.auth.logout(dto.family);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AccessClaims): { sub: string; roles: string[] } {
    return { sub: user.sub, roles: user.roles };
  }
}
