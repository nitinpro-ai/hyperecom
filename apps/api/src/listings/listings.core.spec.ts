import { describe, expect, it } from "vitest";
import {
  validatePublish,
  priceWithinMrp,
  statusForAvailability,
  discountPct,
} from "./listings.core";

describe("listings.core — publish validation matrix", () => {
  const okCtx = {
    imageCount: 1,
    requiredAttrsMissing: [],
    variants: [{ pricePaise: 9000, mrpPaise: 10000, stock: 5 }],
  };

  it("passes a complete listing", () => {
    expect(validatePublish(okCtx)).toEqual({ ok: true });
  });
  it("fails with no image", () => {
    const r = validatePublish({ ...okCtx, imageCount: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.field === "images")).toBe(true);
  });
  it("fails with a missing required attribute", () => {
    const r = validatePublish({ ...okCtx, requiredAttrsMissing: ["size"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.field === "attributes.size")).toBe(true);
  });
  it("fails when price > MRP", () => {
    const r = validatePublish({ ...okCtx, variants: [{ pricePaise: 12000, mrpPaise: 10000, stock: 1 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes("MRP"))).toBe(true);
  });
  it("fails with no variants / no price", () => {
    expect(validatePublish({ ...okCtx, variants: [] }).ok).toBe(false);
    expect(validatePublish({ ...okCtx, variants: [{ pricePaise: 0, mrpPaise: 100, stock: 1 }] }).ok).toBe(false);
  });
});

describe("listings.core — price + status rules", () => {
  it("price must be >0 and ≤MRP", () => {
    expect(priceWithinMrp(9000, 10000)).toBe(true);
    expect(priceWithinMrp(10000, 10000)).toBe(true);
    expect(priceWithinMrp(10001, 10000)).toBe(false);
    expect(priceWithinMrp(0, 10000)).toBe(false);
  });
  it("ACTIVE + 0 stock → OUT_OF_STOCK; OUT_OF_STOCK + stock → ACTIVE", () => {
    expect(statusForAvailability("ACTIVE", 0)).toBe("OUT_OF_STOCK");
    expect(statusForAvailability("OUT_OF_STOCK", 3)).toBe("ACTIVE");
    expect(statusForAvailability("PAUSED", 0)).toBe("PAUSED"); // unchanged
    expect(statusForAvailability("DRAFT", 5)).toBe("DRAFT");
  });
  it("discount percentage", () => {
    expect(discountPct(7500, 10000)).toBe(25);
    expect(discountPct(10000, 10000)).toBe(0);
    expect(discountPct(100, 0)).toBe(0);
  });
});
