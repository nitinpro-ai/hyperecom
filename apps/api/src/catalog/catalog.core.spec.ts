import { describe, expect, it } from "vitest";
import { validateAttributes, normalizeGtin, normalizeName, type AttributeSpec } from "./catalog.core";

const schema: AttributeSpec[] = [
  { key: "size", type: "enum", values: ["S", "M", "L"], required: true },
  { key: "color", type: "string", required: false },
  { key: "weight", type: "number", required: false },
];

describe("catalog.core — attribute validation", () => {
  it("passes when required enum is valid", () => {
    expect(validateAttributes(schema, { size: "M" })).toEqual({ ok: true });
  });
  it("fails when a required attribute is missing", () => {
    const r = validateAttributes(schema, { color: "red" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.find((e) => e.key === "size")).toEqual({ key: "size", message: "required" });
  });
  it("fails when an enum value is not allowed", () => {
    const r = validateAttributes(schema, { size: "XXL" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.key === "size")).toBe(true);
  });
  it("validates number type", () => {
    expect(validateAttributes(schema, { size: "M", weight: 100 })).toEqual({ ok: true });
    const r = validateAttributes(schema, { size: "M", weight: "heavy" });
    expect(r.ok).toBe(false);
  });
  it("empty schema always passes", () => {
    expect(validateAttributes([], { anything: 1 })).toEqual({ ok: true });
    expect(validateAttributes(null, {})).toEqual({ ok: true });
  });
});

describe("catalog.core — GTIN", () => {
  it("normalises valid GTINs (strips spaces/hyphens)", () => {
    expect(normalizeGtin("8 901234 567894")).toBe("8901234567894"); // 13-digit EAN
    expect(normalizeGtin("12345678")).toBe("12345678"); // GTIN-8
  });
  it("rejects invalid GTINs", () => {
    expect(normalizeGtin("123")).toBeNull();
    expect(normalizeGtin("abcd1234")).toBeNull();
    expect(normalizeGtin("")).toBeNull();
    expect(normalizeGtin(undefined)).toBeNull();
  });
});

describe("catalog.core — name normalisation", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeName("  Nike  Air   MAX ")).toBe("nike air max");
  });
});
