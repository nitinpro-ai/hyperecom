import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SellersService } from "./sellers.service";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from "../auth/auth.guard";
import type { AccessClaims } from "../auth/auth.crypto";

interface RegisterDto {
  legalName: string;
  displayName: string;
  businessType: string;
  pan: string;
  gstin?: string;
  autoApproveDev?: boolean;
}

/** M04 — seller onboarding + Seller Studio endpoints + admin KYC queue. */
@Controller()
@UseGuards(JwtAuthGuard)
export class SellersController {
  constructor(
    @Inject(SellersService) private readonly sellers: SellersService,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  @Get("sellers/me")
  async me(@CurrentUser() user: AccessClaims) {
    return this.sellers.getOverview(user.sub);
  }

  @Get("sellers/me/listings")
  async myListings(@CurrentUser() user: AccessClaims, @Query("shopId") shopId?: string) {
    return this.sellers.listSellerListings(user.sub, shopId);
  }

  @Patch("sellers/me/listings/:id")
  async updateMyListing(
    @CurrentUser() user: AccessClaims,
    @Param("id") id: string,
    @Body() dto: { pricePaise?: number; mrpPaise?: number; stockOnHand?: number; status?: "ACTIVE" | "PAUSED"; imageUrl?: string },
  ) {
    const r = await this.sellers.updateSellerListing(user.sub, id, dto);
    if (!r.ok) throw new HttpException(r.reason, r.reason === "PRICE_GT_MRP" ? 422 : 404);
    return { ok: true };
  }

  @Get("sellers/me/orders")
  async myOrders(@CurrentUser() user: AccessClaims, @Query("shopId") shopId?: string) {
    return this.sellers.listSellerOrders(user.sub, shopId);
  }

  @Post("sellers/register")
  async register(@CurrentUser() user: AccessClaims, @Body() dto: RegisterDto) {
    const r = await this.sellers.register({
      userId: user.sub,
      legalName: dto.legalName,
      displayName: dto.displayName,
      businessType: dto.businessType,
      pan: dto.pan,
      gstin: dto.gstin,
    });
    if (!r.ok) {
      const msgMap: Record<string, string> = {
        INVALID_PAN: "Invalid PAN format. Expected 5 uppercase letters + 4 digits + 1 letter (e.g. ABCDE1234F).",
        INVALID_GSTIN: "Invalid GSTIN format. Expected 15-character GSTIN (e.g. 09ABCDE1234F1Z5).",
        ALREADY_REGISTERED: "Seller KYC is already registered for this account.",
      };
      throw new HttpException(
        { error: r.reason, message: msgMap[r.reason] ?? r.reason },
        r.reason === "ALREADY_REGISTERED" ? 409 : 400,
      );
    }
    await this.sellers.ensureSellerOwnerRole(user.sub);
    if (dto.autoApproveDev && process.env.NODE_ENV !== "production") {
      await this.sellers.devApproveForUser(user.sub);
    }
    const tokens = await this.auth.issueTokensForUserId(user.sub);
    return { sellerId: r.sellerId, tokens };
  }

  @Post("sellers/me/submit-kyc")
  async submitKyc(@CurrentUser() user: AccessClaims) {
    const r = await this.sellers.submitKycForUser(user.sub);
    if (!r.ok) throw new HttpException(r.reason, r.reason === "NOT_FOUND" ? 404 : 409);
    await this.sellers.ensureSellerOwnerRole(user.sub);
    const tokens = await this.auth.issueTokensForUserId(user.sub);
    return { status: r.status, tokens };
  }

  @Post("sellers/me/dev-approve")
  async devApprove(@CurrentUser() user: AccessClaims) {
    if (process.env.NODE_ENV === "production") {
      throw new HttpException("FORBIDDEN_IN_PROD", 403);
    }
    const r = await this.sellers.devApproveForUser(user.sub);
    if (!r.ok) throw new HttpException(r.reason, 404);
    const tokens = await this.auth.issueTokensForUserId(user.sub);
    return { sellerId: r.sellerId, status: r.status, tokens };
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
