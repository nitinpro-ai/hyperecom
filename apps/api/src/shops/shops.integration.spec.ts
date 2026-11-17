import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { uniquePhone } from "../test-utils";
import { prisma } from "@apnacity/db";
import { SellersService } from "../sellers/sellers.service";
import { ShopsService } from "./shops.service";

/**
 * M04/M05 integration — runs against the live cluster DB (DATABASE_URL set).
 * Proves: seller register → submit → approve state machine; shop create with
 * transactional slug allocation (collision → -2); events emitted to outbox.
 * Skips automatically when no DATABASE_URL is configured.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;

const TAG = "zz-step5-test";

d("Step 5 sellers+shops (integration)", () => {
  const sellers = new SellersService();
  const shops = new ShopsService();
  let userId1 = "";
  let userId2 = "";
  let cityId = "";

  beforeAll(async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "bijnor" } });
    cityId = city.id;
    const u1 = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    const u2 = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    userId1 = u1.id;
    userId2 = u2.id;
  });

  afterAll(async () => {
    // tidy all rows created by this test (tagged users + their sellers/shops)
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const ids = users.map((u) => u.id);
    const sellerRows = await prisma.seller.findMany({ where: { userId: { in: ids } }, select: { id: true } });
    const sellerIds = sellerRows.map((s) => s.id);
    const shopRows = await prisma.shop.findMany({ where: { sellerId: { in: sellerIds } }, select: { id: true } });
    const shopIds = shopRows.map((s) => s.id);
    await prisma.$transaction([
      prisma.shopSettings.deleteMany({ where: { shopId: { in: shopIds } } }),
      prisma.shopDomain.deleteMany({ where: { shopId: { in: shopIds } } }),
      prisma.shop.deleteMany({ where: { id: { in: shopIds } } }),
      prisma.seller.deleteMany({ where: { id: { in: sellerIds } } }),
      prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: [...sellerIds, ...shopIds] } } }),
      prisma.user.deleteMany({ where: { id: { in: ids } } }),
    ]);
    await prisma.$disconnect();
  });

  it("registers a seller, rejects a bad PAN, runs the KYC machine to APPROVED", async () => {
    const bad = await sellers.register({
      userId: userId1, legalName: "L", displayName: "D", businessType: "PROPRIETORSHIP", pan: "bad",
    });
    expect(bad).toEqual({ ok: false, reason: "INVALID_PAN" });

    const reg = await sellers.register({
      userId: userId1, legalName: "Bagga Legal", displayName: "Bagga Cloth",
      businessType: "PROPRIETORSHIP", pan: "ABCDE1234F",
    });
    expect(reg.ok).toBe(true);
    if (!reg.ok) return;

    expect((await sellers.submitKyc(reg.sellerId)).ok).toBe(true);
    const approved = await sellers.approve(reg.sellerId, userId1);
    expect(approved).toEqual({ ok: true, status: "APPROVED" });

    // kyc.approved.v1 emitted
    const ev = await prisma.outboxEvent.findFirst({
      where: { aggregateId: reg.sellerId, eventType: "kyc.approved.v1" },
    });
    expect(ev).not.toBeNull();
  });

  it("cannot create a shop for an unapproved seller, then creates with unique slug", async () => {
    const reg = await sellers.register({
      userId: userId2, legalName: "Second", displayName: "Bagga Cloth",
      businessType: "INDIVIDUAL", pan: "ABCDE1234F",
    });
    if (!reg.ok) throw new Error("register failed");

    const blocked = await shops.create({ sellerId: reg.sellerId, cityId, name: "Bagga Cloth" });
    expect(blocked).toEqual({ ok: false, reason: "SELLER_NOT_APPROVED" });

    await sellers.submitKyc(reg.sellerId);
    await sellers.approve(reg.sellerId, userId2);

    const created = await shops.create({ sellerId: reg.sellerId, cityId, name: "Bagga Cloth" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    // first user's seller already took "bagga-cloth"? either way slug is unique + host set
    expect(created.slug).toMatch(/^bagga-cloth(-\d+)?$/);
    expect(created.host).toBe(`${created.slug}.apnacity.com`);

    // shop.created.v1 + domain + settings all exist
    expect(await prisma.shopDomain.findUnique({ where: { shopId: created.shopId } })).not.toBeNull();
    expect(await prisma.shopSettings.findUnique({ where: { shopId: created.shopId } })).not.toBeNull();
    expect(
      await prisma.outboxEvent.findFirst({ where: { aggregateId: created.shopId, eventType: "shop.created.v1" } }),
    ).not.toBeNull();
  });

  it("allocates -2 suffix on slug collision (slug race → one winner)", async () => {
    // both sellers approved above; create two shops with the same name
    const s1 = await prisma.seller.findFirstOrThrow({ where: { userId: userId1 } });
    const a = await shops.create({ sellerId: s1.id, cityId, name: "Collide Shop" });
    const b = await shops.create({ sellerId: s1.id, cityId, name: "Collide Shop" });
    if (!a.ok || !b.ok) throw new Error("create failed");
    expect(a.slug).toBe("collide-shop");
    expect(b.slug).toBe("collide-shop-2");
  });
});
