import { describe, expect, it } from "vitest";
import {
  checkUpload,
  sniffMime,
  contentMatchesDeclared,
  bucketFor,
  isPrivateKind,
  derivativePlan,
  storageKey,
  allowedMimesFor,
  MAX_IMAGE_BYTES,
  MAX_PRODUCT_IMAGES,
} from "./media.core";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

describe("media.core — upload validation", () => {
  it("accepts an allowed image within size + quota", () => {
    expect(checkUpload({ kind: "PRODUCT_IMAGE", mime: "image/jpeg", sizeBytes: 1000 })).toEqual({ ok: true });
  });
  it("rejects a disallowed MIME", () => {
    expect(checkUpload({ kind: "PRODUCT_IMAGE", mime: "image/gif", sizeBytes: 1000 }))
      .toEqual({ ok: false, reason: "MIME_NOT_ALLOWED" });
  });
  it("rejects oversize uploads (>5MB)", () => {
    expect(checkUpload({ kind: "LOGO", mime: "image/png", sizeBytes: MAX_IMAGE_BYTES + 1 }))
      .toEqual({ ok: false, reason: "TOO_LARGE" });
  });
  it("enforces ≤6 product images per shop", () => {
    expect(
      checkUpload({ kind: "PRODUCT_IMAGE", mime: "image/jpeg", sizeBytes: 100 }, { existingProductImages: MAX_PRODUCT_IMAGES }),
    ).toEqual({ ok: false, reason: "TOO_MANY_IMAGES" });
  });
  it("enforces the per-shop quota", () => {
    expect(
      checkUpload({ kind: "BANNER", mime: "image/webp", sizeBytes: 1000 }, { shopUsedBytes: 100, shopQuotaBytes: 500 }),
    ).toEqual({ ok: false, reason: "QUOTA_EXCEEDED" });
  });
  it("DOCUMENT kind also allows PDF", () => {
    expect(allowedMimesFor("DOCUMENT").has("application/pdf")).toBe(true);
    expect(allowedMimesFor("PRODUCT_IMAGE").has("application/pdf")).toBe(false);
  });
});

describe("media.core — content sniffing (anti-spoof)", () => {
  it("detects real magic bytes", () => {
    expect(sniffMime(JPEG)).toBe("image/jpeg");
    expect(sniffMime(PNG)).toBe("image/png");
    expect(sniffMime(WEBP)).toBe("image/webp");
    expect(sniffMime(PDF)).toBe("application/pdf");
  });
  it("returns null for unknown content", () => {
    expect(sniffMime(new Uint8Array([0, 1, 2, 3]))).toBeNull();
  });
  it("accepts matching declared MIME", () => {
    expect(contentMatchesDeclared("image/png", PNG)).toBe(true);
  });
  it("rejects a spoof (declared jpeg, actually png)", () => {
    expect(contentMatchesDeclared("image/jpeg", PNG)).toBe(false);
  });
});

describe("media.core — bucket + keys + derivatives", () => {
  it("routes private kinds to the private bucket", () => {
    expect(isPrivateKind("DOCUMENT")).toBe(true);
    expect(isPrivateKind("POD")).toBe(true);
    expect(isPrivateKind("RETURN_PHOTO")).toBe(true);
    expect(bucketFor("DOCUMENT")).toBe("private");
    expect(bucketFor("PRODUCT_IMAGE")).toBe("public");
  });
  it("builds a storage key under the right bucket", () => {
    expect(storageKey("LOGO", "m1", "image/png")).toBe("public/logo/m1/original.png");
    expect(storageKey("DOCUMENT", "d1", "application/pdf")).toBe("private/document/d1/original.pdf");
  });
  it("plans 256/512/1024 WebP derivatives for images, none for DOCUMENT", () => {
    const plan = derivativePlan("PRODUCT_IMAGE", "m1");
    expect(Object.keys(plan)).toEqual(["256", "512", "1024"]);
    expect(plan["256"]).toBe("public/product_image/m1/256.webp");
    expect(derivativePlan("DOCUMENT", "d1")).toEqual({});
  });
});
