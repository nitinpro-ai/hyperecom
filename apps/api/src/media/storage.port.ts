import { Injectable } from "@nestjs/common";

/**
 * Storage abstraction (S3/MinIO in prod; local in dev/tests). The service
 * depends only on this port so M10 works before MinIO is available on the
 * cluster (Docker Hub rate-limit — see infrastructure/CLUSTER.md).
 */
export interface PresignedUpload {
  uploadUrl: string;
  storageKey: string;
  expiresInSec: number;
}

export interface StoragePort {
  /** Issue a presigned PUT URL (10-min TTL) for a key. */
  presignUpload(bucket: "private" | "public", key: string): Promise<PresignedUpload>;
  /** Issue a presigned GET URL for private objects (expires); public = CDN path. */
  presignDownload(bucket: "private" | "public", key: string): Promise<string>;
  /** Does the object exist (used by /complete to confirm the client PUT). */
  exists(bucket: "private" | "public", key: string): Promise<boolean>;
}

const PRESIGN_TTL_SEC = 600; // 10 min (spec M10)

/**
 * Dev/local storage: records "uploaded" keys in memory and mints fake-but-shaped
 * URLs. Lets the full presign → complete → process flow run and be tested
 * without MinIO. Swap for an S3/MinIO impl (same interface) in prod.
 */
@Injectable()
export class LocalStoragePort implements StoragePort {
  private objects = new Set<string>();
  private readonly base = process.env.MEDIA_BASE_URL ?? "http://localhost:9000";

  async presignUpload(bucket: "private" | "public", key: string): Promise<PresignedUpload> {
    // In dev we immediately mark the object as present (no real PUT round-trip).
    this.objects.add(`${bucket}/${key}`);
    return {
      uploadUrl: `${this.base}/${bucket}/${key}?X-Amz-Expires=${PRESIGN_TTL_SEC}&dev=1`,
      storageKey: key,
      expiresInSec: PRESIGN_TTL_SEC,
    };
  }

  async presignDownload(bucket: "private" | "public", key: string): Promise<string> {
    if (bucket === "public") return `${this.base}/public/${key}`;
    return `${this.base}/private/${key}?X-Amz-Expires=${PRESIGN_TTL_SEC}&dev=1`;
  }

  async exists(bucket: "private" | "public", key: string): Promise<boolean> {
    return this.objects.has(`${bucket}/${key}`);
  }
}
