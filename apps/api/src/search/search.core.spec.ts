import { describe, expect, it } from "vitest";
import { normalizeQuery, expandSynonyms, orderByClause, rankScore, acceptsTypo } from "./search.core";

describe("search.core — query normalisation + synonyms", () => {
  it("normalises case/punctuation/whitespace", () => {
    expect(normalizeQuery("  Nike  Air-MAX!! ")).toBe("nike air max");
  });
  it("expands synonyms", () => {
    expect(expandSynonyms("mobile", { mobile: ["phone", "smartphone"] }).sort()).toEqual(["mobile", "phone", "smartphone"]);
  });
});

describe("search.core — sort whitelist", () => {
  it("maps sort keys to safe ORDER BY clauses", () => {
    expect(orderByClause("price_asc")).toBe("price_paise ASC");
    expect(orderByClause("nearest")).toContain("distance_m ASC");
    expect(orderByClause("relevance")).toContain("relevance DESC");
    // unknown/undefined → relevance default
    expect(orderByClause(undefined)).toContain("relevance DESC");
  });
});

describe("search.core — ranking", () => {
  it("in-stock ranks above out-of-stock at equal relevance", () => {
    const a = rankScore({ relevance: 0.8, inStock: true, ratingAvg: 4 });
    const b = rankScore({ relevance: 0.8, inStock: false, ratingAvg: 4 });
    expect(a).toBeGreaterThan(b);
  });
  it("higher rating ranks higher", () => {
    expect(rankScore({ relevance: 0.8, inStock: true, ratingAvg: 5 }))
      .toBeGreaterThan(rankScore({ relevance: 0.8, inStock: true, ratingAvg: 2 }));
  });
  it("sponsored is boosted (but caller labels it)", () => {
    expect(rankScore({ relevance: 0.5, inStock: true, ratingAvg: 4, sponsored: true }))
      .toBeGreaterThan(rankScore({ relevance: 0.5, inStock: true, ratingAvg: 4 }));
  });
  it("typo acceptance floor", () => {
    expect(acceptsTypo(0.35)).toBe(true);
    expect(acceptsTypo(0.2)).toBe(false);
  });
});
