import { describe, expect, it } from "vitest";
import {
  isValidPan,
  isValidGstin,
  canTransition,
  nextStatus,
  slugify,
  allocateSlug,
} from "./sellers.core";

describe("PAN validation", () => {
  it("accepts a well-formed PAN", () => {
    expect(isValidPan("ABCDE1234F")).toBe(true);
  });
  it("rejects malformed PANs", () => {
    expect(isValidPan("ABCD1234F")).toBe(false); // too short
    expect(isValidPan("ABCDE12345")).toBe(false); // ends with digit
    expect(isValidPan("abcde1234f")).toBe(false); // lowercase
    expect(isValidPan("12345ABCDF")).toBe(false); // wrong shape
  });
});

describe("GSTIN validation (structure + mod-36 checksum)", () => {
  it("accepts a GSTIN with a correct checksum", () => {
    expect(isValidGstin("27ABCDE1234F1Z0")).toBe(true);
  });
  it("rejects a GSTIN with a wrong checksum", () => {
    expect(isValidGstin("27ABCDE1234F1Z9")).toBe(false);
  });
  it("rejects structurally invalid GSTINs", () => {
    expect(isValidGstin("27ABCDE1234F1Z")).toBe(false); // too short
    expect(isValidGstin("ZZABCDE1234F1Z0")).toBe(false); // state not digits
  });
});

describe("KYC state machine", () => {
  it("allows the legal happy path DRAFT→KYC_PENDING→APPROVED", () => {
    expect(nextStatus("DRAFT", "SUBMIT")).toBe("KYC_PENDING");
    expect(nextStatus("KYC_PENDING", "APPROVE")).toBe("APPROVED");
  });
  it("allows APPROVED⇄SUSPENDED", () => {
    expect(nextStatus("APPROVED", "SUSPEND")).toBe("SUSPENDED");
    expect(nextStatus("SUSPENDED", "REINSTATE")).toBe("APPROVED");
  });
  it("allows REJECTED→resubmit→KYC_PENDING", () => {
    expect(nextStatus("KYC_PENDING", "REJECT")).toBe("REJECTED");
    expect(nextStatus("REJECTED", "RESUBMIT")).toBe("KYC_PENDING");
  });
  it("forbids illegal transitions", () => {
    expect(canTransition("DRAFT", "APPROVE")).toBe(false);
    expect(canTransition("APPROVED", "APPROVE")).toBe(false);
    expect(canTransition("REJECTED", "APPROVE")).toBe(false);
    expect(nextStatus("DRAFT", "APPROVE")).toBeNull();
  });
});

describe("slug allocation", () => {
  it("slugifies names", () => {
    expect(slugify("Bagga Cloth House")).toBe("bagga-cloth-house");
    expect(slugify("  Raju's Kirana!! ")).toBe("raju-s-kirana");
    expect(slugify("")).toBe("shop");
  });
  it("returns the base slug when free", () => {
    expect(allocateSlug("Bagga Cloth", new Set())).toBe("bagga-cloth");
  });
  it("collision → -2 suffix (slug race: exactly one winner keeps base)", () => {
    expect(allocateSlug("Bagga Cloth", new Set(["bagga-cloth"]))).toBe("bagga-cloth-2");
  });
  it("multiple collisions increment the suffix", () => {
    const taken = new Set(["bagga-cloth", "bagga-cloth-2", "bagga-cloth-3"]);
    expect(allocateSlug("Bagga Cloth", taken)).toBe("bagga-cloth-4");
  });
});
