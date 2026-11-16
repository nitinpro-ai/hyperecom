import { describe, expect, it } from "vitest";
import { computeQuote, validateCoupon, orderNo, type CouponDef, type CouponContext } from "./checkout.core";

describe("computeQuote — multi-shop split", () => {
  const lines = [
    { shopId: "A", listingVariantId: "a1", quantity: 1, unitPricePaise: 79900, taxRateBp: 500 },
    { shopId: "A", listingVariantId: "a2", quantity: 2, unitPricePaise: 10000, taxRateBp: 500 },
    { shopId: "B", listingVariantId: "b1", quantity: 1, unitPricePaise: 50000, taxRateBp: 1200 },
    { shopId: "C", listingVariantId: "c1", quantity: 3, unitPricePaise: 20000, taxRateBp: 0 },
  ];
  const fees = { A: 4000, B: 3000, C: 5000 };

  it("groups by shop with per-shop totals + delivery", () => {
    const q = computeQuote(lines, fees);
    expect(q.shopGroups).toHaveLength(3);
    const a = q.shopGroups.find((g) => g.shopId === "A")!;
    expect(a.itemsTotalPaise).toBe(79900 + 20000); // 99900
    expect(a.deliveryFeePaise).toBe(4000);
    expect(q.itemsTotalPaise).toBe(99900 + 50000 + 60000); // 209900
    expect(q.deliveryTotalPaise).toBe(12000);
    expect(q.grandTotalPaise).toBe(209900 + 12000);
  });

  it("applies and caps discount, never below zero total", () => {
    const q = computeQuote(lines, fees, 10000);
    expect(q.discountPaise).toBe(10000);
    expect(q.grandTotalPaise).toBe(209900 + 12000 - 10000);
    const over = computeQuote(lines, fees, 9_999_999);
    expect(over.discountPaise).toBe(209900); // capped at items total
  });

  it("tax is tracked (inclusive) and non-zero for taxed lines", () => {
    const q = computeQuote(lines, fees);
    expect(q.taxTotalPaise).toBeGreaterThan(0);
  });
});

describe("validateCoupon — stack", () => {
  const base: CouponDef = {
    scope: "PLATFORM", type: "PERCENT", valueBp: 1000, minOrderPaise: 50000,
    maxDiscountPaise: 10000, usageLimit: 100, perUserLimit: 1, isActive: true,
    validFrom: new Date("2026-01-01"), validTo: new Date("2027-01-01"),
  };
  const ctx: CouponContext = {
    itemsTotalPaise: 100000, deliveryTotalPaise: 4000, cityId: "bijnor",
    shopIds: ["A"], now: new Date("2026-06-01"), totalRedemptions: 0, userRedemptions: 0,
  };

  it("PERCENT applies and respects max cap", () => {
    const r = validateCoupon(base, ctx);
    expect(r).toEqual({ ok: true, discountPaise: 10000 }); // 10% of 100000 = 10000, == cap
    const r2 = validateCoupon({ ...base, valueBp: 5000 }, ctx);
    expect(r2.ok && r2.discountPaise).toBe(10000); // 50% capped at 10000
  });
  it("FLAT and FREE_DELIVERY", () => {
    expect(validateCoupon({ ...base, type: "FLAT", valuePaise: 5000 }, ctx)).toEqual({ ok: true, discountPaise: 5000 });
    expect(validateCoupon({ ...base, type: "FREE_DELIVERY" }, ctx)).toEqual({ ok: true, discountPaise: 4000 });
  });
  it("rejects below min order", () => {
    expect(validateCoupon(base, { ...ctx, itemsTotalPaise: 10000 })).toEqual({ ok: false, reason: "MIN_ORDER" });
  });
  it("rejects inactive / out of window", () => {
    expect(validateCoupon({ ...base, isActive: false }, ctx).ok).toBe(false);
    expect(validateCoupon(base, { ...ctx, now: new Date("2030-01-01") })).toEqual({ ok: false, reason: "OUT_OF_WINDOW" });
  });
  it("enforces scope (CITY/SHOP) and limits", () => {
    expect(validateCoupon({ ...base, scope: "CITY", cityId: "delhi" }, ctx)).toEqual({ ok: false, reason: "SCOPE" });
    expect(validateCoupon({ ...base, scope: "SHOP", shopId: "Z" }, ctx)).toEqual({ ok: false, reason: "SCOPE" });
    expect(validateCoupon(base, { ...ctx, totalRedemptions: 100 })).toEqual({ ok: false, reason: "USAGE_LIMIT" });
    expect(validateCoupon(base, { ...ctx, userRedemptions: 1 })).toEqual({ ok: false, reason: "USER_LIMIT" });
  });
});

describe("orderNo", () => {
  it("formats APN-YYYY-NNNNNN", () => {
    expect(orderNo(123, 2026)).toBe("APN-2026-000123");
  });
});
