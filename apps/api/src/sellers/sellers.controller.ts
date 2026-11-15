import {
  Body,
  Controller,
  HttpException,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { SellersService } from "./sellers.service";
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from "../auth/auth.guard";
import type { AccessClaims } from "../auth/auth.crypto";

interface RegisterDto {
  legalName: string;
  displayName: string;
  businessType: string;
  pan: string;
  gstin?: string;
}

/** M04 — seller onboarding + admin KYC queue. */
@Controller()
@UseGuards(JwtAuthGuard)
export class SellersController {
  constructor(@Inject(SellersService) private readonly sellers: SellersService) {}

  @Post("sellers/register")
  async register(@CurrentUser() user: AccessClaims, @Body() dto: RegisterDto) {
    const r = await this.sellers.register({ userId: user.sub, ...dto });
    if (!r.ok) throw new HttpException(r.reason, r.reason === "ALREADY_REGISTERED" ? 409 : 400);
    return { sellerId: r.sellerId };
  }

  @Post("sellers/me/submit-kyc")
  async submitKyc(@CurrentUser() user: AccessClaims) {
    const r = await this.sellers.submitKycForUser(user.sub);
    if (!r.ok) throw new HttpException(r.reason, r.reason === "NOT_FOUND" ? 404 : 409);
    return { status: r.status };
  }

  @Post("admin/sellers/:id/approve")
  @UseGuards(RolesGuard)
  @Roles("SUPER_ADMIN", "CITY_ADMIN")
  async approve(@CurrentUser() admin: AccessClaims, @Param("id") id: string) {
    const r = await this.sellers.approve(id, admin.sub);
    if (!r.ok) throw new HttpException(r.reason, r.reason === "NOT_FOUND" ? 404 : 409);
    return { status: r.status };
  }

  @Post("admin/sellers/:id/reject")
  @UseGuards(RolesGuard)
  @Roles("SUPER_ADMIN", "CITY_ADMIN")
  async reject(@Param("id") id: string) {
    const r = await this.sellers.reject(id);
    if (!r.ok) throw new HttpException(r.reason, r.reason === "NOT_FOUND" ? 404 : 409);
    return { status: r.status };
  }

  @Post("admin/sellers/:id/suspend")
  @UseGuards(RolesGuard)
  @Roles("SUPER_ADMIN")
  async suspend(@Param("id") id: string) {
    const r = await this.sellers.suspend(id);
    if (!r.ok) throw new HttpException(r.reason, r.reason === "NOT_FOUND" ? 404 : 409);
    return { status: r.status };
  }
}
