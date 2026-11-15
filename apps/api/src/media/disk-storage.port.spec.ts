import { describe, expect, it, afterAll } from "vitest";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DiskStoragePort } from "./disk-storage.port";

const ROOT = join(tmpdir(), `apnacity-media-test-${Date.now()}`);

describe("DiskStoragePort (real disk backend, no S3)", () => {
  const store = new DiskStoragePort({
    root: ROOT,
    publicBase: "http://localhost:4000/v1/media/file",
    ttlSec: 600,
    signSecret: "test-sign",
  });

  afterAll(async () => {
    await rm(ROOT, { recursive: true, force: true });
  });

  it("writes and reads an object back byte-for-byte", async () => {
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    await store.putObject("public", "product_image/m1/original.png", data);
    expect(await store.exists("public", "product_image/m1/original.png")).toBe(true);
    const got = await store.getObject("public", "product_image/m1/original.png");
    expect(Buffer.compare(got, data)).toBe(0);
  });

  it("reports missing objects", async () => {
    expect(await store.exists("public", "nope/x.png")).toBe(false);
  });

  it("public download is a plain CDN-style path", async () => {
    const url = await store.presignDownload("public", "logo/s1/256.webp");
    expect(url).toBe("http://localhost:4000/v1/media/file/public/logo/s1/256.webp");
  });

  it("private download is HMAC-signed with an expiry that verifies", async () => {
    const url = await store.presignDownload("private", "document/d1/original.pdf");
    expect(url).toContain("/private/document/d1/original.pdf?");
    const u = new URL(url);
    const exp = Number(u.searchParams.get("exp"));
    const sig = u.searchParams.get("sig")!;
    expect(store.verify("document/d1/original.pdf", exp, sig)).toBe(true);
    // tampered signature fails
    expect(store.verify("document/d1/original.pdf", exp, "deadbeef")).toBe(false);
    // expired fails
    expect(store.verify("document/d1/original.pdf", 1, store.sign("document/d1/original.pdf", 1))).toBe(false);
  });

  it("presignUpload returns a direct-upload URL with the key and TTL", async () => {
    const p = await store.presignUpload("public", "product_image/m2/original.jpeg");
    expect(p.storageKey).toBe("product_image/m2/original.jpeg");
    expect(p.expiresInSec).toBe(600);
    expect(p.uploadUrl).toContain("direct-upload");
  });
});
