import { Injectable, Inject } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import {
  checkUpload,
  bucketFor,
  storageKey as buildKey,
  derivativePlan,
  isPrivateKind,
  contentMatchesDeclared,
  type MediaKind,
} from "./media.core";
import { LocalStoragePort, type StoragePort } from "./storage.port";

export const STORAGE_PORT = Symbol("STORAGE_PORT");

export interface UploadUrlInput {
  ownerUserId: string;
  shopId?: string;
  kind: MediaKind;
  mime: string;
  sizeBytes: number;
}

/**
 * M10 — Media. Presign → client PUT → complete → process (derivatives+scan) →
 * media.processed.v1. Validation + content-sniffing in media.core; storage via
 * StoragePort (dev local; prod MinIO/S3). sharp derivatives + virus scan run in
 * the process worker (stubbed here; wired when MinIO + sharp are available).
 */
@Injectable()
export class MediaService {
  constructor(
    @Inject(STORAGE_PORT) private readonly storage: StoragePort = new LocalStoragePort(),
  ) {}

  async requestUploadUrl(input: UploadUrlInput) {
    // quota + product-image count from DB
    const ctx: Parameters<typeof checkUpload>[1] = {};
    if (input.shopId) {
      const agg = await prisma.media.aggregate({
        where: { shopId: input.shopId },
        _sum: { sizeBytes: true },
      });
      ctx.shopUsedBytes = agg._sum.sizeBytes ?? 0;
      if (input.kind === "PRODUCT_IMAGE") {
        ctx.existingProductImages = await prisma.media.count({
          where: { shopId: input.shopId, kind: "PRODUCT_IMAGE" },
        });
      }
    }

    const check = checkUpload(
      { kind: input.kind, mime: input.mime, sizeBytes: input.sizeBytes },
      ctx,
    );
    if (!check.ok) return { ok: false as const, reason: check.reason };

    const media = await prisma.media.create({
      data: {
        ownerUserId: input.ownerUserId,
        shopId: input.shopId ?? null,
        kind: input.kind,
        mime: input.mime,
        sizeBytes: input.sizeBytes,
        storageKey: "", // set below once we know the id
        scanStatus: "PENDING",
      },
    });
    const key = buildKey(input.kind, media.id, input.mime);
    await prisma.media.update({ where: { id: media.id }, data: { storageKey: key } });

    const presigned = await this.storage.presignUpload(bucketFor(input.kind), key);
    return {
      ok: true as const,
      mediaId: media.id,
      uploadUrl: presigned.uploadUrl,
      expiresInSec: presigned.expiresInSec,
    };
  }

  /**
   * Confirm the client PUT, verify content (anti-spoof), plan derivatives,
   * mark CLEAN (real virus scan runs in the worker), emit media.processed.v1.
   * `header` = first bytes of the uploaded object for magic-byte sniffing.
   */
  async complete(mediaId: string, header?: Uint8Array) {
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return { ok: false as const, reason: "NOT_FOUND" };

    const kind = media.kind as MediaKind;
    const present = await this.storage.exists(bucketFor(kind), media.storageKey);
    if (!present) return { ok: false as const, reason: "NOT_UPLOADED" };

    // Anti-spoof: when we have the header bytes, the content MUST match the MIME.
    if (header && !contentMatchesDeclared(media.mime, header)) {
      await prisma.media.update({ where: { id: mediaId }, data: { scanStatus: "REJECTED" } });
      return { ok: false as const, reason: "MIME_SPOOF" };
    }

    const variants = derivativePlan(kind, mediaId);
    await prisma.$transaction(async (tx) => {
      await tx.media.update({
        where: { id: mediaId },
        data: { variants, scanStatus: "CLEAN" }, // worker does real EXIF strip + scan
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "media",
          aggregateId: mediaId,
          eventType: "media.processed.v1",
          payload: { mediaId, kind, variants },
        },
      });
    });
    return { ok: true as const, mediaId, variants };
  }

  /** GET /media/{id} — public kinds return CDN path; private return a signed URL. */
  async get(mediaId: string) {
    const media = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!media) return null;
    const kind = media.kind as MediaKind;
    const url = await this.storage.presignDownload(bucketFor(kind), media.storageKey);
    return {
      id: media.id,
      kind: media.kind,
      mime: media.mime,
      scanStatus: media.scanStatus,
      private: isPrivateKind(kind),
      url,
      variants: media.variants,
    };
  }
}
