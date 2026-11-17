import { Body, Controller, Inject, Param, Post, HttpException, UseGuards } from "@nestjs/common";
import { ListingsService } from "./listings.service";
import { JwtAuthGuard, RolesGuard, Roles } from "../auth/auth.guard";

interface DraftDto {
  productId: string;
  titleOverride?: string;
  variants: Array<{ variantId: string; sellerSku: string; mrpPaise: number; pricePaise: number; taxRateBp?: number }>;
}

/** M08 — seller listing writes (authed SELLER): draft a listing, publish it. */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SELLER_OWNER", "SELLER_STAFF", "SUPER_ADMIN")
export class ListingsSellerController {
  constructor(@Inject(ListingsService) private readonly listings: ListingsService) {}

  @Post("shops/:shopId/listings/draft")
  async draft(@Param("shopId") shopId: string, @Body() dto: DraftDto) {
    const r = await this.listings.createDraft({ shopId, productId: dto.productId, titleOverride: dto.titleOverride, variants: dto.variants });
    if (!r.ok) throw new HttpException(r.reason, r.reason === "DUPLICATE" ? 409 : 400);
    return { listingId: r.listingId };
  }

  @Post("listings/:id/publish")
  async publish(@Param("id") id: string, @Body() dto: { imageCount?: number; requiredAttrsMissing?: string[] }) {
    const r = await this.listings.publish(id, { imageCount: dto.imageCount ?? 1, requiredAttrsMissing: dto.requiredAttrsMissing ?? [] });
    if (!r.ok) {
      if (r.reason === "VALIDATION") throw new HttpException({ error: "VALIDATION", validation: r.validation }, 422);
      throw new HttpException(r.reason, 404);
    }
    return { status: r.status };
  }
}
