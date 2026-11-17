import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { uniquePhone } from "../test-utils";
import { prisma } from "@apnacity/db";
import { CatalogService } from "../catalog/catalog.service";
import { ListingsService } from "./listings.service";

/**
 * Step 7 integration — live cluster DB. Proves the core promise:
 * category → product (M07, GTIN dedupe + schema) → draft listing + variant (M08)
 * → publish (validation matrix) → public offers (same-variant). Self-cleans.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-step7";

d("Step 7 catalog + listings (integration)", () => {
  const catalog = new CatalogService();
  const listings = new ListingsService();
  let categoryId = "";
  let shopId = "";
  let sellerId = "";
  let userId = "";
  let productId = "";
  let variantId = "";
  // unique 13-digit GTIN per run so the shared CI DB doesn't collide across builds
  const GTIN = `89${String(Date.now()).slice(-11)}`;

  beforeAll(async () => {
    const cat = await prisma.category.create({
      data: {
        name: `${TAG}-shirts`, slug: `${TAG}-shirts-${Date.now()}`, pathText: "root.shirts",
        attributeSchema: [{ key: "size", type: "enum", values: ["S", "M", "L"], required: true }],
      },
    });
    categoryId = cat.id;
    const u = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    userId = u.id;
    const seller = await prisma.seller.create({
      data: { userId, legalName: TAG, displayName: TAG, businessType: "INDIVIDUAL", pan: "ABCDE1234F", status: "APPROVED" },
    });
    sellerId = seller.id;
    const city = await prisma.city.findFirst({ where: { slug: "bijnor" } })
      ?? await prisma.city.findFirstOrThrow(); // fall back to any seeded city
    const shop = await prisma.shop.create({
      data: { sellerId, cityId: city.id, name: `${TAG}-shop`, slug: `${TAG}-shop-${Date.now()}`, status: "ACTIVE" },
    });
    shopId = shop.id;
  });

  afterAll(async () => {
    // delete in FK order — scope by ALL TAG users (not just this run's ids) so
    // orphans from a prior failed run on the shared DB don't block user delete.
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const uids = users.map((u) => u.id);
    const sellers = await prisma.seller.findMany({ where: { userId: { in: uids } }, select: { id: true } });
    const sids = sellers.map((s) => s.id);
    const shops = await prisma.shop.findMany({ where: { sellerId: { in: sids } }, select: { id: true } });
    const shopIds = shops.map((s) => s.id);
    const lvs = await prisma.listingVariant.findMany({ where: { shopId: { in: shopIds } }, select: { id: true } });
    const lvIds = lvs.map((x) => x.id);
    await prisma.priceHistory.deleteMany({ where: { listingVariantId: { in: lvIds } } });
    await prisma.listingVariant.deleteMany({ where: { shopId: { in: shopIds } } });
    await prisma.sellerListing.deleteMany({ where: { shopId: { in: shopIds } } });
    if (productId) await prisma.productVariant.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { categoryId } });
    await prisma.matchGroup.deleteMany({ where: { canonicalProductId: productId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [productId, ...shopIds, ...sids] } } });
    await prisma.shop.deleteMany({ where: { id: { in: shopIds } } });
    await prisma.seller.deleteMany({ where: { id: { in: sids } } });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
    await prisma.$disconnect();
  });

  it("M07: rejects invalid attributes, then creates a product + variant", async () => {
    const bad = await catalog.matchOrCreate({ categoryId, name: "Blue Shirt", attributes: { size: "XXL" } });
    expect(bad).toMatchObject({ ok: false, reason: "ATTR_INVALID" });

    const good = await catalog.matchOrCreate({
      categoryId, name: "Blue Cotton Shirt", gtin: GTIN, attributes: { size: "M" }, createdBy: userId,
    });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    productId = good.productId;
    expect(good.matched).toBe("CREATED");

    const v = await prisma.productVariant.create({
      data: { productId, sku: `${TAG}-sku-M`, attributes: { size: "M" } },
    });
    variantId = v.id;

    // product.created.v1 emitted
    expect(await prisma.outboxEvent.findFirst({ where: { aggregateId: productId, eventType: "product.created.v1" } })).not.toBeNull();
  });

  it("M07: GTIN dedupe attaches to the existing master", async () => {
    const dup = await catalog.matchOrCreate({ categoryId, name: "Totally Different Name", gtin: GTIN, attributes: { size: "M" } });
    expect(dup).toMatchObject({ ok: true, matched: "GTIN", productId });
  });

  it("M08: draft → publish fails without image, passes with image → ACTIVE + offers", async () => {
    const draft = await listings.createDraft({
      shopId, productId,
      variants: [{ variantId, sellerSku: `${TAG}-ssku`, mrpPaise: 100000, pricePaise: 90000 }],
    });
    expect(draft.ok).toBe(true);
    if (!draft.ok) return;

    const noImg = await listings.publish(draft.listingId, { imageCount: 0 });
    expect(noImg).toMatchObject({ ok: false, reason: "VALIDATION" });

    const ok = await listings.publish(draft.listingId, { imageCount: 1 });
    expect(ok).toEqual({ ok: true, status: "ACTIVE" });

    // listing.published.v1 emitted
    expect(await prisma.outboxEvent.findFirst({ where: { aggregateId: draft.listingId, eventType: "listing.published.v1" } })).not.toBeNull();

    // public offers for the same variant
    const offers = await listings.offers(productId, variantId);
    expect(offers.length).toBe(1);
    expect(offers[0]).toMatchObject({ shopId, pricePaise: 90000, mrpPaise: 100000 });
  });

  it("M08: price>MRP rejected; price change writes price_history", async () => {
    const bad = await listings.createDraft({
      shopId, productId: productId, // duplicate product → DUPLICATE, but price check first
      variants: [{ variantId, sellerSku: "x", mrpPaise: 100, pricePaise: 200 }],
    });
    expect(bad).toMatchObject({ ok: false, reason: "PRICE_GT_MRP" });

    const lv = await prisma.listingVariant.findFirstOrThrow({ where: { shopId } });
    const before = await prisma.priceHistory.count({ where: { listingVariantId: lv.id } });
    await listings.quickEdit(lv.id, { pricePaise: 85000, changedBy: userId });
    const after = await prisma.priceHistory.count({ where: { listingVariantId: lv.id } });
    expect(after).toBe(before + 1);
  });
});
