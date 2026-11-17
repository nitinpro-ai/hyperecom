import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { uniquePhone } from "../test-utils";
import { ReviewsService } from "./reviews.service";

/**
 * M21 integration (live DB): verified-purchase enforcement (unverified rejected),
 * one review per item, exact aggregate recompute on product + shop.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-m21";

d("M21 reviews (integration)", () => {
  const reviews = new ReviewsService();
  let userId = "", otherUserId = "", productId = "", shopId = "", itemDelivered = "", itemOther = "";

  beforeAll(async () => {
    const city = await prisma.city.findFirstOrThrow();
    const u = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    userId = u.id;
    const o = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    otherUserId = o.id;
    const seller = await prisma.seller.create({ data: { userId: u.id, legalName: TAG, displayName: TAG, businessType: "INDIVIDUAL", pan: "ABCDE1234F", status: "APPROVED" } });
    const shop = await prisma.shop.create({ data: { sellerId: seller.id, cityId: city.id, name: `${TAG}s`, slug: `${TAG}shop${Date.now()}`, status: "ACTIVE" } });
    shopId = shop.id;
    const cat = await prisma.category.create({ data: { name: `${TAG}c`, slug: `${TAG}c${Date.now()}`, pathText: "r" } });
    const prod = await prisma.product.create({ data: { categoryId: cat.id, name: `${TAG}p`, slug: `${TAG}p${Date.now()}`, status: "ACTIVE" } });
    productId = prod.id;
    const order = await prisma.order.create({ data: { orderNo: `APN-M21-${Date.now()}`, userId: u.id, cityId: city.id, addressSnapshot: {}, itemsTotalPaise: 100000n, deliveryTotalPaise: 0n, taxTotalPaise: 0n, grandTotalPaise: 100000n, status: "PLACED" } });
    // DELIVERED seller order (verified purchase) + a second item for a 2nd review
    const soD = await prisma.sellerOrder.create({ data: { orderId: order.id, shopId: shop.id, sellerOrderNo: `${order.orderNo}-1`, itemsTotalPaise: 100000n, deliveryFeePaise: 0n, taxTotalPaise: 0n, status: "DELIVERED", deliveredAt: new Date() } });
    itemDelivered = (await prisma.orderItem.create({ data: { sellerOrderId: soD.id, orderId: order.id, productId: prod.id, quantity: 1, unitPricePaise: 100000n, lineTotalPaise: 100000n, nameSnapshot: "x", skuSnapshot: "x" } })).id;
    itemOther = (await prisma.orderItem.create({ data: { sellerOrderId: soD.id, orderId: order.id, productId: prod.id, quantity: 1, unitPricePaise: 100000n, lineTotalPaise: 100000n, nameSnapshot: "y", skuSnapshot: "y" } })).id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const uids = users.map((u) => u.id);
    await prisma.review.deleteMany({ where: { userId: { in: uids } } });
    const ords = await prisma.order.findMany({ where: { userId: { in: uids } }, select: { id: true } });
    const oids = ords.map((o) => o.id);
    await prisma.orderItem.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.sellerOrder.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.order.deleteMany({ where: { id: { in: oids } } });
    const shops = await prisma.shop.findMany({ where: { name: { startsWith: `${TAG}s` } }, select: { id: true } });
    await prisma.shop.deleteMany({ where: { id: { in: shops.map((s) => s.id) } } });
    await prisma.seller.deleteMany({ where: { userId: { in: uids } } });
    await prisma.product.deleteMany({ where: { name: `${TAG}p` } });
    await prisma.category.deleteMany({ where: { name: `${TAG}c` } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
    await prisma.$disconnect();
  });

  it("rejects a review from a non-purchaser (verified-purchase gate)", async () => {
    const r = await reviews.submit({ userId: otherUserId, orderItemId: itemDelivered, rating: 5 });
    expect(r).toMatchObject({ ok: false, reason: "NOT_VERIFIED_PURCHASE" });
  });

  it("accepts a verified purchase review + recomputes aggregates exactly", async () => {
    const r = await reviews.submit({ userId, orderItemId: itemDelivered, rating: 4, body: "good" });
    expect(r.ok).toBe(true);
    const prod = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(Number(prod.ratingAvg)).toBe(4);
    expect(prod.ratingCount).toBe(1);
    const shop = await prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    expect(Number(shop.ratingAvg)).toBe(4);
  });

  it("one review per order_item (duplicate rejected)", async () => {
    const dup = await reviews.submit({ userId, orderItemId: itemDelivered, rating: 1 });
    expect(dup).toMatchObject({ ok: false, reason: "ALREADY_REVIEWED" });
  });

  it("second review recomputes the EXACT mean (4 then 2 → avg 3)", async () => {
    await reviews.submit({ userId, orderItemId: itemOther, rating: 2, body: "ok" });
    const prod = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(Number(prod.ratingAvg)).toBe(3); // (4+2)/2, exact — not incremental drift
    expect(prod.ratingCount).toBe(2);
  });
});
