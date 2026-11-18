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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{10,15}$/;

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
  async register(@Body() dto: RegisterEmailDto) {
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

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginEmailDto) {
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
