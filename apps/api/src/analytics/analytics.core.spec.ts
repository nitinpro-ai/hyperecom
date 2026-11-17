import { describe, expect, it } from "vitest";
import { stripPii, dayBucket, rollupScopes, authorizeDashboard } from "./analytics.core";

describe("analytics.core — PII stripping", () => {
  it("removes PII keys, keeps dimensions", () => {
    const out = stripPii({ productId: "p1", valuePaise: 1000, phone: "+91999", email: "a@b.c", query: "shoes" });
    expect(out).toEqual({ productId: "p1", valuePaise: 1000, query: "shoes" });
    expect(out.phone).toBeUndefined();
    expect(out.email).toBeUndefined();
  });
});

describe("analytics.core — rollup scopes", () => {
  it("platform always; +city +shop when present", () => {
    expect(rollupScopes({}).map((s) => s[0])).toEqual(["PLATFORM"]);
    expect(rollupScopes({ cityId: "c" }).map((s) => s[0])).toEqual(["PLATFORM", "CITY"]);
    expect(rollupScopes({ cityId: "c", shopId: "s" }).map((s) => s[0])).toEqual(["PLATFORM", "CITY", "SHOP"]);
  });
  it("day bucket is the UTC date", () => {
    expect(dayBucket(new Date("2026-11-17T22:30:00Z"))).toBe("2026-11-17");
  });
});

describe("analytics.core — dashboard authorization (tenant isolation)", () => {
  const sellerCtx = { shopIds: ["shopA", "shopB"] };
  it("SELLER can read only their own shop", () => {
    expect(authorizeDashboard("SELLER", { scope: "SHOP", scopeId: "shopA" }, sellerCtx)).toEqual({ scope: "SHOP", scopeId: "shopA" });
    expect(authorizeDashboard("SELLER", { scope: "SHOP", scopeId: "shopZ" }, sellerCtx)).toBeNull(); // not theirs
    expect(authorizeDashboard("SELLER", { scope: "PLATFORM" }, sellerCtx)).toBeNull();
    expect(authorizeDashboard("SELLER", { scope: "CITY", scopeId: "c" }, sellerCtx)).toBeNull();
  });
  it("CITY_ADMIN limited to own city", () => {
    const ctx = { cityId: "cityX" };
    expect(authorizeDashboard("CITY_ADMIN", { scope: "CITY", scopeId: "cityX" }, ctx)).toEqual({ scope: "CITY", scopeId: "cityX" });
    expect(authorizeDashboard("CITY_ADMIN", { scope: "CITY", scopeId: "cityY" }, ctx)).toBeNull();
    expect(authorizeDashboard("CITY_ADMIN", { scope: "PLATFORM" }, ctx)).toBeNull();
  });
  it("SUPER_ADMIN sees anything", () => {
    expect(authorizeDashboard("SUPER_ADMIN", { scope: "PLATFORM" }, {})).toEqual({ scope: "PLATFORM", scopeId: null });
  });
});
