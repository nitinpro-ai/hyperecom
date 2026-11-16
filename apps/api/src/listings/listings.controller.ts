import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ListingsService } from "./listings.service";
import { prisma } from "@apnacity/db";

/** M08 — public listing reads: PDP offers (same-variant across shops) + storefront catalogue. */
@Controller()
export class ListingsController {
  constructor(@Inject(ListingsService) private readonly listings: ListingsService) {}

  /** PDP: all shops' offers for the SAME product+variant (sorted by price). */
  @Get("products/:id/offers")
  offers(
    @Param("id") productId: string,
    @Query("variantId") variantId: string,
    @Query("cityId") cityId?: string,
  ) {
    return this.listings.offers(productId, variantId, cityId);
  }

  /** Storefront catalogue: a shop's ACTIVE listings (public). */
  @Get("shops/:shopId/catalogue")
  async catalogue(@Param("shopId") shopId: string) {
    const rows = await prisma.sellerListing.findMany({
      where: { shopId, status: "ACTIVE" },
      select: {
        id: true, productId: true, titleOverride: true,
        product: { select: { name: true, slug: true } },
        variants: {
          where: { isActive: true },
          select: { id: true, variantId: true, pricePaise: true, mrpPaise: true },
          take: 1,
        },
      },
      take: 100,
    });
    return rows.map((r) => ({
      listingId: r.id,
      productId: r.productId,
      title: r.titleOverride ?? r.product.name,
      slug: r.product.slug,
      pricePaise: r.variants[0] ? Number(r.variants[0].pricePaise) : null,
      mrpPaise: r.variants[0] ? Number(r.variants[0].mrpPaise) : null,
    }));
  }
}
