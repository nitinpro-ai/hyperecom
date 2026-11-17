import { describe, expect, it } from "vitest";
import { withinEditWindow, recomputeAverage, needsModeration } from "./reviews.core";

describe("reviews.core", () => {
  it("edit window: within 7 days ok, after not", () => {
    expect(withinEditWindow(new Date(Date.now() - 3 * 86400e3))).toBe(true);
    expect(withinEditWindow(new Date(Date.now() - 8 * 86400e3))).toBe(false);
  });
  it("exact average (not incremental), rounded 2dp", () => {
    expect(recomputeAverage([5, 4, 4])).toEqual({ avg: 4.33, count: 3 });
    expect(recomputeAverage([])).toEqual({ avg: 0, count: 0 });
    expect(recomputeAverage([1, 2, 3, 4, 5])).toEqual({ avg: 3, count: 5 });
  });
  it("profanity gate flags blocked words for moderation", () => {
    expect(needsModeration("great product")).toBe(false);
    expect(needsModeration("this is badword1")).toBe(true);
    expect(needsModeration(null)).toBe(false);
  });
});
