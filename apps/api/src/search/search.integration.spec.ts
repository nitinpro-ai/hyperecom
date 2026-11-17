import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { uniquePhone } from "../test-utils";
import { SearchService } from "./search.service";

/**
 * M11 integration (live DB): typo tolerance ("nkie" finds Nike), city + ACTIVE
 * scoping, price filter, suggest. Seeds an ACTIVE Nike listing then searches.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-m11";

d("M11 search (integration)", () => {
  const search = new SearchService();
  let productId = "", cityId = "", otherCityId = "";

  beforeAll(async () => {
    const city = await prisma.city.findFirstOrThrow();
    cityId = city.id;
    const other = await prisma.city.findFirst({ where: { id: { not: cityId } } });
    otherCityId = other?.id ?? cityId;
    const u = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    const seller = await prisma.seller.create({ data: { userId: u.id, legalName: TAG, displayName: TAG, businessType: "INDIVIDUAL", pan: "ABCDE1234F", status: "APPROVED" } });
    const shop = await prisma.shop.create({ data: { sellerId: seller.id, cityId, name: `${TAG}s`, slug: `${TAG}shop${Date.now()}`, status: "ACTIVE" } });
    const cat = await prisma.category.create({ data: { name: `${TAG}c`, slug: `${TAG}c${Date.now()}`, pathText: "r" } });
    const prod = await prisma.product.create({ data: { categoryId: cat.id, name: "Nike Air Max 270 Running Shoes", slug: `${TAG}nike${Date.now()}`, status: "ACTIVE" } });
    productId = prod.id;
    const variant = await prisma.productVariant.create({ data: { productId: prod.id, attributes: {} } });
    const listing = await prisma.sellerListing.create({ data: { shopId: shop.id, productId: prod.id, status: "ACTIVE" } });
    const lv = await prisma.listingVariant.create({ data: { listingId: listing.id, shopId: shop.id, variantId: variant.id, sellerSku: `${TAG}sku${Date.now()}`, mrpPaise: 499900n, pricePaise: 329900n } });
    const loc = await prisma.inventoryLocation.create({ data: { shopId: shop.id } });
    await prisma.stock.create({ data: { locationId: loc.id, listingVariantId: lv.id, quantityOnHand: 5, quantityReserved: 0 } });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const uids = users.map((u) => u.id);
    const shops = await prisma.shop.findMany({ where: { name: { startsWith: `${TAG}s` } }, select: { id: true } });
    const sids = shops.map((s) => s.id);
    const lvs = await prisma.listingVariant.findMany({ where: { shopId: { in: sids } }, select: { id: true } });
    const stocks = await prisma.stock.findMany({ where: { listingVariantId: { in: lvs.map((l) => l.id) } }, select: { id: true } });
    await prisma.stockMovement.deleteMany({ where: { stockId: { in: stocks.map((s) => s.id) } } });
    await prisma.stock.deleteMany({ where: { id: { in: stocks.map((s) => s.id) } } });
    await prisma.inventoryLocation.deleteMany({ where: { shopId: { in: sids } } });
    await prisma.listingVariant.deleteMany({ where: { shopId: { in: sids } } });
    await prisma.sellerListing.deleteMany({ where: { shopId: { in: sids } } });
    await prisma.shop.deleteMany({ where: { id: { in: sids } } });
    await prisma.seller.deleteMany({ where: { userId: { in: uids } } });
    await prisma.productVariant.deleteMany({ where: { product: { name: { startsWith: "Nike Air Max 270" } } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: `${TAG}nike` } } });
    await prisma.category.deleteMany({ where: { name: `${TAG}c` } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
    await prisma.$disconnect();
  });

  it("exact term finds the product", async () => {
    const hits = await search.query("nike shoes", { cityId });
    expect(hits.some((h) => h.productId === productId)).toBe(true);
  });

  it("TYPO tolerance: 'nkie shoos' still finds Nike (pg_trgm)", async () => {
    const hits = await search.query("nkie shoos", { cityId });
    expect(hits.some((h) => h.productId === productId)).toBe(true);
  });

  it("city scoping: searching a DIFFERENT city excludes the listing", async () => {
    if (otherCityId === cityId) return; // only one city seeded — skip
    const hits = await search.query("nike", { cityId: otherCityId });
    expect(hits.some((h) => h.productId === productId)).toBe(false);
  });

  it("price filter + in-stock flag", async () => {
    const hit = (await search.query("nike", { cityId, maxPrice: 400000 })).find((h) => h.productId === productId);
    expect(hit).toBeDefined();
    expect(hit!.inStock).toBe(true);
    // priced above filter → excluded
    const none = await search.query("nike", { cityId, maxPrice: 100000 });
    expect(none.some((h) => h.productId === productId)).toBe(false);
  });

  it("suggest returns the product name for a partial query", async () => {
    const s = await search.suggest("nike air");
    expect(s.some((n) => n.includes("Nike Air Max"))).toBe(true);
  });
});
