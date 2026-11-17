import { describe, expect, it } from "vitest";
import { gstSplit, invoiceNo, creditNoteNo, gstSeries } from "./invoicing.core";

describe("invoicing.core — GST split", () => {
  it("intra-state → CGST + SGST (each half), no IGST", () => {
    const r = gstSplit(100000, 1200, "UP", "UP"); // 12% of ₹1000
    expect(r.totalTaxPaise).toBe(12000);
    expect(r.cgstPaise + r.sgstPaise).toBe(12000);
    expect(r.cgstPaise).toBe(6000);
    expect(r.igstPaise).toBe(0);
  });
  it("inter-state → full IGST, no CGST/SGST", () => {
    const r = gstSplit(100000, 1200, "UP", "DL");
    expect(r.igstPaise).toBe(12000);
    expect(r.cgstPaise).toBe(0);
    expect(r.sgstPaise).toBe(0);
  });
  it("odd tax splits without losing a paisa", () => {
    const r = gstSplit(100001, 500, "UP", "UP"); // 5% → 5000.05 → 5000
    expect(r.cgstPaise + r.sgstPaise).toBe(r.totalTaxPaise);
  });
});

describe("invoicing.core — numbering", () => {
  it("invoice + credit note numbers", () => {
    expect(invoiceNo("BAGGA2627", 42)).toBe("BAGGA2627/00042");
    expect(creditNoteNo("BAGGA2627", 3)).toBe("BAGGA2627-CN/00003");
  });
  it("GST series uses Indian FY (Apr–Mar)", () => {
    expect(gstSeries("BAGGA", new Date("2026-05-01"))).toBe("BAGGA2627"); // FY 26-27
    expect(gstSeries("BAGGA", new Date("2026-02-01"))).toBe("BAGGA2526"); // FY 25-26
  });
});
