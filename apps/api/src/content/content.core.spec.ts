import { describe, expect, it } from "vitest";
import { bannerActive } from "./content.core";

describe("content.core — banner window", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  it("active with no window", () => {
    expect(bannerActive({ isActive: true }, now)).toBe(true);
  });
  it("inactive flag → false", () => {
    expect(bannerActive({ isActive: false }, now)).toBe(false);
  });
  it("before activeFrom / after activeTo → false", () => {
    expect(bannerActive({ isActive: true, activeFrom: new Date("2026-07-01") }, now)).toBe(false);
    expect(bannerActive({ isActive: true, activeTo: new Date("2026-06-01") }, now)).toBe(false);
  });
  it("within window → true", () => {
    expect(bannerActive({ isActive: true, activeFrom: new Date("2026-06-01"), activeTo: new Date("2026-06-30") }, now)).toBe(true);
  });
});
