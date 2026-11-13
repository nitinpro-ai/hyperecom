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
