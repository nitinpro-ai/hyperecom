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
import { ShopsService } from "./shops.service";
import { JwtAuthGuard } from "../auth/auth.guard";

interface CreateShopDto {
  sellerId: string;
  cityId: string;
  name: string;
  description?: string;
}

/** M05/M06 — shop creation + public tenant resolution. */
@Controller()
export class ShopsController {
  constructor(@Inject(ShopsService) private readonly shops: ShopsService) {}

  @Post("shops")
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateShopDto) {
    const r = await this.shops.create(dto);
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
