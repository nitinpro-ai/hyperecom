import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { AnalyticsService } from "./analytics.service";

/**
 * M25 integration (live DB): track strips PII; rollup aggregates count + GMV per
 * scope; seller dashboard isolation (sees own shop only, correct numbers).
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const SHOP_A = "a0000000-0000-4000-8000-0000000000a1";
const SHOP_B = "b0000000-0000-4000-8000-0000000000b1";
const CITY = "c0000000-0000-4000-8000-0000000000c1";
const DAY = new Date();

d("M25 analytics (integration)", () => {
  const analytics = new AnalyticsService();

  afterAll(async () => {
    await prisma.analyticsRollup.deleteMany({ where: { day: new Date(DAY.toISOString().slice(0, 10)) } });
    await prisma.analyticsEvent.deleteMany({ where: { shopId: { in: [SHOP_A, SHOP_B] } } });
    await prisma.$disconnect();
  });

  it("track strips PII from the payload", async () => {
    await analytics.track({ eventType: "PRODUCT_VIEW", cityId: CITY, shopId: SHOP_A, payload: { productId: "p1", phone: "+91999", email: "x@y.z" } });
    const ev = await prisma.analyticsEvent.findFirstOrThrow({ where: { shopId: SHOP_A, eventType: "PRODUCT_VIEW" } });
    const p = ev.payload as Record<string, unknown>;
    expect(p.productId).toBe("p1");
    expect(p.phone).toBeUndefined();
    expect(p.email).toBeUndefined();
  });

  it("rollup aggregates count + GMV per shop/city/platform", async () => {
    // 2 orders for shop A (₹1000 + ₹500), 1 for shop B (₹300)
    await analytics.track({ eventType: "ORDER_PLACED", cityId: CITY, shopId: SHOP_A, valuePaise: 100000 });
    await analytics.track({ eventType: "ORDER_PLACED", cityId: CITY, shopId: SHOP_A, valuePaise: 50000 });
    await analytics.track({ eventType: "ORDER_PLACED", cityId: CITY, shopId: SHOP_B, valuePaise: 30000 });

    await analytics.runRollup(DAY);
    const day = new Date(DAY.toISOString().slice(0, 10));

    const shopA = await prisma.analyticsRollup.findFirstOrThrow({ where: { day, scope: "SHOP", scopeId: SHOP_A, eventType: "ORDER_PLACED" } });
    expect(shopA.count).toBe(2);
    expect(Number(shopA.valuePaise)).toBe(150000);

    // platform rollup sums all 3 orders
    const platform = await prisma.analyticsRollup.findFirstOrThrow({ where: { day, scope: "PLATFORM", scopeId: null, eventType: "ORDER_PLACED" } });
    expect(platform.count).toBe(3);
    expect(Number(platform.valuePaise)).toBe(180000);
  });

  it("seller dashboard sees ONLY own shop (isolation)", async () => {
    const range = { from: DAY, to: DAY };
    // seller who owns SHOP_A
    const ownA = await analytics.dashboard("SELLER", { scope: "SHOP", scopeId: SHOP_A }, { shopIds: [SHOP_A] }, range);
    expect(ownA.ok).toBe(true);
    if (ownA.ok) {
      const orders = ownA.rows.find((r) => r.eventType === "ORDER_PLACED");
      expect(orders?.count).toBe(2);
      expect(orders?.valuePaise).toBe(150000);
    }
    // the SAME seller asking for shop B → FORBIDDEN
    const otherB = await analytics.dashboard("SELLER", { scope: "SHOP", scopeId: SHOP_B }, { shopIds: [SHOP_A] }, range);
    expect(otherB).toEqual({ ok: false, reason: "FORBIDDEN" });
    // seller asking for PLATFORM → FORBIDDEN
    const plat = await analytics.dashboard("SELLER", { scope: "PLATFORM" }, { shopIds: [SHOP_A] }, range);
    expect(plat).toEqual({ ok: false, reason: "FORBIDDEN" });
  });

  it("rollup is idempotent (re-running the same day doesn't double-count)", async () => {
    await analytics.runRollup(DAY);
    await analytics.runRollup(DAY);
    const day = new Date(DAY.toISOString().slice(0, 10));
    const shopA = await prisma.analyticsRollup.findFirstOrThrow({ where: { day, scope: "SHOP", scopeId: SHOP_A, eventType: "ORDER_PLACED" } });
    expect(shopA.count).toBe(2); // still 2, not 4
  });
});
