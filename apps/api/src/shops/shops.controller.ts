import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { ShopsService } from "./shops.service";
import { JwtAuthGuard, CurrentUser } from "../auth/auth.guard";
import type { AccessClaims } from "../auth/auth.crypto";

interface CreateShopDto {
  sellerId?: string;
  cityId: string;
  name: string;
  description?: string;
}

/** M05/M06 — shop creation + public tenant resolution + public cities list. */
@Controller()
export class ShopsController {
  constructor(@Inject(ShopsService) private readonly shops: ShopsService) {}

  @Get("cities")
  async cities() {
    const rows = await prisma.city.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, state: { select: { name: true, code: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      stateName: c.state.name,
      stateCode: c.state.code,
    }));
  }

  @Post("shops")
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: AccessClaims, @Body() dto: CreateShopDto) {
    let sellerId = dto.sellerId;
    if (!sellerId) {
      const seller = await prisma.seller.findUnique({ where: { userId: user.sub } });
      if (!seller) throw new HttpException("SELLER_NOT_FOUND", 404);
      sellerId = seller.id;
    }
    const r = await this.shops.create({
      sellerId,
      cityId: dto.cityId,
      name: dto.name,
      description: dto.description,
    });
    if (!r.ok) {
      const code = r.reason === "SELLER_NOT_APPROVED" ? 403 : 404;
      throw new HttpException(r.reason, code);
    }
    return { shopId: r.shopId, slug: r.slug, host: r.host };
  }

  /** M06 — internal host→tenant resolution (prod: HMAC-signed, Redis 60 s). */
  @Get("internal/resolve-tenant")
  async resolveTenant(@Query("host") host: string) {
    const tenant = await this.shops.resolveTenant(host);
    if (!tenant) throw new HttpException("unknown host", 404);
    return tenant;
  }

  @Get("storefront/resolve")
  async resolveStorefront(@Query("slug") slug: string) {
    const shop = await this.shops.resolveBySlug(slug);
    if (!shop) throw new HttpException("unknown shop", 404);
    return shop;
  }
}
