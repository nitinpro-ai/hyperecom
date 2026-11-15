import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { MediaService } from "./media.service";
import { LocalStoragePort } from "./storage.port";

/**
 * M10 integration — live cluster DB (DATABASE_URL set). Proves presign →
 * complete → media.processed.v1 with derivatives, and MIME-spoof rejection.
 * Uses LocalStoragePort (MinIO deferred — Docker Hub rate-limit).
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-m10-test";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

d("M10 media (integration)", () => {
  const media = new MediaService(new LocalStoragePort());
  let userId = "";

  beforeAll(async () => {
    const u = await prisma.user.create({ data: { phone: `+91${String(Date.now()).slice(-9)}`, name: TAG } });
    userId = u.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const ids = users.map((u) => u.id);
    const mrows = await prisma.media.findMany({ where: { ownerUserId: { in: ids } }, select: { id: true } });
    const mids = mrows.map((m) => m.id);
    await prisma.$transaction([
      prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: mids } } }),
      prisma.media.deleteMany({ where: { id: { in: mids } } }),
      prisma.user.deleteMany({ where: { id: { in: ids } } }),
    ]);
    await prisma.$disconnect();
  });

  it("presign → complete generates derivatives + emits media.processed.v1", async () => {
    const req = await media.requestUploadUrl({
      ownerUserId: userId, kind: "PRODUCT_IMAGE", mime: "image/png", sizeBytes: 2048,
    });
    expect(req.ok).toBe(true);
    if (!req.ok) return;
    expect(req.uploadUrl).toContain("X-Amz-Expires=600");

    const done = await media.complete(req.mediaId, PNG);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(Object.keys(done.variants)).toEqual(["256", "512", "1024"]);

    const row = await prisma.media.findUnique({ where: { id: req.mediaId } });
    expect(row?.scanStatus).toBe("CLEAN");
    expect(
      await prisma.outboxEvent.findFirst({ where: { aggregateId: req.mediaId, eventType: "media.processed.v1" } }),
    ).not.toBeNull();
  });

  it("rejects a MIME spoof at complete (declared jpeg, bytes are png)", async () => {
    const req = await media.requestUploadUrl({
      ownerUserId: userId, kind: "PRODUCT_IMAGE", mime: "image/jpeg", sizeBytes: 2048,
    });
    if (!req.ok) throw new Error("presign failed");
    const done = await media.complete(req.mediaId, PNG); // png bytes ≠ declared jpeg
    expect(done).toMatchObject({ ok: false, reason: "MIME_SPOOF" });
    const row = await prisma.media.findUnique({ where: { id: req.mediaId } });
    expect(row?.scanStatus).toBe("REJECTED");
  });

  it("DOCUMENT kind routes to the private bucket and signs a URL", async () => {
    const req = await media.requestUploadUrl({
      ownerUserId: userId, kind: "DOCUMENT", mime: "application/pdf", sizeBytes: 1024,
    });
    if (!req.ok) throw new Error("presign failed");
    await media.complete(req.mediaId);
    const got = await media.get(req.mediaId);
    expect(got?.private).toBe(true);
    expect(got?.url).toContain("private/");
    expect(got?.url).toContain("X-Amz-Expires");
  });
});
