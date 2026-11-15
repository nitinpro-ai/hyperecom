import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { validatePublish, priceWithinMrp, type PublishValidation } from "./listings.core";

export interface DraftListingInput {
  shopId: string;
  productId: string;
  titleOverride?: string;
  variants: Array<{
    variantId: string;
    sellerSku: string;
    mrpPaise: number;
    pricePaise: number;
    taxRateBp?: number;
  }>;
}

export type DraftResult =
  | { ok: true; listingId: string }
  | { ok: false; reason: "PRICE_GT_MRP" | "DUPLICATE" };

export type PublishResult =
  | { ok: true; status: "ACTIVE" }
  | { ok: false; reason: "NOT_FOUND" | "VALIDATION"; validation?: PublishValidation };

@Injectable()
export class ListingsService {
  /** Create a DRAFT listing + its variant rows (price≤MRP enforced). */
  async createDraft(input: DraftListingInput): Promise<DraftResult> {
    for (const v of input.variants) {
      if (!priceWithinMrp(v.pricePaise, v.mrpPaise)) return { ok: false, reason: "PRICE_GT_MRP" };
    }
    const existing = await prisma.sellerListing.findUnique({
      where: { shopId_productId: { shopId: input.shopId, productId: input.productId } },
    });
    if (existing) return { ok: false, reason: "DUPLICATE" };

    const listing = await prisma.$transaction(async (tx) => {
      const l = await tx.sellerListing.create({
        data: {
          shopId: input.shopId,
          productId: input.productId,
          titleOverride: input.titleOverride ?? null,
          status: "DRAFT",
        },
      });
      for (const v of input.variants) {
        const lv = await tx.listingVariant.create({
          data: {
            listingId: l.id,
            shopId: input.shopId,
            variantId: v.variantId,
            sellerSku: v.sellerSku,
            mrpPaise: BigInt(v.mrpPaise),
            pricePaise: BigInt(v.pricePaise),
            taxRateBp: v.taxRateBp ?? 0,
          },
        });
        await tx.priceHistory.create({
          data: { listingVariantId: lv.id, pricePaise: BigInt(v.pricePaise), reason: "initial" },
        });
      }
      return l;
    });
    return { ok: true, listingId: listing.id };
  }

  /** Quick edit price/stock on a variant; every price change → price_history. */
  async quickEdit(
    listingVariantId: string,
    changes: { pricePaise?: number; changedBy?: string },
  ): Promise<{ ok: boolean; reason?: string }> {
    const lv = await prisma.listingVariant.findUnique({ where: { id: listingVariantId } });
    if (!lv) return { ok: false, reason: "NOT_FOUND" };
    if (changes.pricePaise != null) {
      if (!priceWithinMrp(changes.pricePaise, Number(lv.mrpPaise))) {
        return { ok: false, reason: "PRICE_GT_MRP" };
      }
      await prisma.$transaction([
        prisma.listingVariant.update({
          where: { id: listingVariantId },
          data: { pricePaise: BigInt(changes.pricePaise) },
        }),
        prisma.priceHistory.create({
          data: {
            listingVariantId,
            pricePaise: BigInt(changes.pricePaise),
            changedBy: changes.changedBy ?? null,
            reason: "quick-edit",
          },
        }),
      ]);
    }
    return { ok: true };
  }

  /**
   * Publish: enforce the validation matrix (≥1 image + required attrs + price +
   * stock). availabilityByVariant lets the caller pass current stock (M09 later;
   * default treat as available so draft→publish works pre-inventory).
   */
  async publish(
    listingId: string,
    opts: { imageCount: number; requiredAttrsMissing?: string[]; availabilityByVariant?: Record<string, number> } = { imageCount: 0 },
  ): Promise<PublishResult> {
    const listing = await prisma.sellerListing.findUnique({
      where: { id: listingId },
      include: { variants: true },
    });
    if (!listing) return { ok: false, reason: "NOT_FOUND" };

    const validation = validatePublish({
      imageCount: opts.imageCount,
      requiredAttrsMissing: opts.requiredAttrsMissing ?? [],
      variants: listing.variants.map((v) => ({
        pricePaise: Number(v.pricePaise),
        mrpPaise: Number(v.mrpPaise),
        stock: opts.availabilityByVariant?.[v.variantId] ?? 1, // default available until M09
      })),
    });
    if (!validation.ok) return { ok: false, reason: "VALIDATION", validation };

    await prisma.$transaction(async (tx) => {
      await tx.sellerListing.update({
        where: { id: listingId },
        data: { status: "ACTIVE", listedAt: new Date() },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "listing",
          aggregateId: listingId,
          eventType: "listing.published.v1",
          payload: { listingId, shopId: listing.shopId, productId: listing.productId },
        },
      });
    });
    return { ok: true, status: "ACTIVE" };
  }

  async pause(listingId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.sellerListing.update({ where: { id: listingId }, data: { status: "PAUSED" } });
      await tx.outboxEvent.create({
        data: { aggregateType: "listing", aggregateId: listingId, eventType: "listing.paused.v1", payload: { listingId } },
      });
    });
  }

  async resume(listingId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.sellerListing.update({ where: { id: listingId }, data: { status: "ACTIVE" } });
      await tx.outboxEvent.create({
        data: { aggregateType: "listing", aggregateId: listingId, eventType: "listing.updated.v1", payload: { listingId } },
      });
    });
  }

  /**
   * Public offers: all ACTIVE listings for the SAME product+variant across shops
   * in a city, sorted by price (distance/ETA/rating refine with M03/reviews).
   */
  async offers(productId: string, variantId: string, cityId?: string) {
    const rows = await prisma.listingVariant.findMany({
      where: {
        variantId,
        isActive: true,
        listing: {
          productId,
          status: "ACTIVE",
          ...(cityId ? { shop: { is: { cityId } } } : {}),
        },
      },
      select: {
        id: true, pricePaise: true, mrpPaise: true, sellerSku: true,
        listing: { select: { id: true, shopId: true } },
      },
      orderBy: { pricePaise: "asc" },
    });
    return rows.map((r) => ({
      listingVariantId: r.id,
      listingId: r.listing.id,
      shopId: r.listing.shopId,
      pricePaise: Number(r.pricePaise),
      mrpPaise: Number(r.mrpPaise),
    }));
  }
}
