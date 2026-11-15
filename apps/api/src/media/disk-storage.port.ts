import { Injectable } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { StoragePort, PresignedUpload } from "./storage.port";

/**
 * Disk-backed object storage — a REAL, working media backend that needs no S3
 * and no MinIO. Files live under MEDIA_DISK_ROOT (a local dir in dev, a mounted
 * PVC in the cluster). Public objects are served by the API's file endpoint;
 * private objects get an HMAC-signed, time-limited URL the endpoint verifies.
 *
 * Swap for S3StoragePort (same interface) by setting MEDIA_STORAGE_DRIVER=s3.
 */
@Injectable()
export class DiskStoragePort implements StoragePort {
  private readonly root: string;
  private readonly publicBase: string;
  private readonly ttlSec: number;
  private readonly signSecret: string;

  constructor(opts?: {
    root?: string;
    publicBase?: string;
    ttlSec?: number;
    signSecret?: string;
  }) {
    this.root = resolve(opts?.root ?? process.env.MEDIA_DISK_ROOT ?? "./.media-data");
    this.publicBase =
      opts?.publicBase ??
      process.env.MEDIA_PUBLIC_BASE_URL ??
      "http://localhost:4000/v1/media/file";
    this.ttlSec = opts?.ttlSec ?? Number.parseInt(process.env.MEDIA_SIGNED_URL_TTL ?? "600", 10);
    this.signSecret = opts?.signSecret ?? process.env.MEDIA_SIGN_SECRET ?? "dev-media-sign";
  }

  private pathFor(bucket: "private" | "public", key: string): string {
    // prevent path traversal: key segments are app-generated but be safe
    const safe = key.replace(/\.\.(\/|\\|$)/g, "");
    return join(this.root, bucket, safe);
  }

  /** Dev "presign": returns the API's own PUT-complete endpoint; the client
   *  uploads bytes to POST /media/:id/complete (multipart) which calls putObject. */
  async presignUpload(bucket: "private" | "public", key: string): Promise<PresignedUpload> {
    return {
      uploadUrl: `${this.publicBase.replace("/file", "")}/direct-upload?bucket=${bucket}&key=${encodeURIComponent(key)}`,
      storageKey: key,
      expiresInSec: this.ttlSec,
    };
  }

  /** Write bytes to disk (called by the direct-upload handler / worker). */
  async putObject(bucket: "private" | "public", key: string, data: Buffer): Promise<void> {
    const p = this.pathFor(bucket, key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  async getObject(bucket: "private" | "public", key: string): Promise<Buffer> {
    return readFile(this.pathFor(bucket, key));
  }

  async presignDownload(bucket: "private" | "public", key: string): Promise<string> {
    if (bucket === "public") return `${this.publicBase}/public/${key}`;
    // private: HMAC-signed URL with expiry the file endpoint verifies
    const exp = Math.floor(Date.now() / 1000) + this.ttlSec;
    const sig = this.sign(key, exp);
    return `${this.publicBase}/private/${key}?exp=${exp}&sig=${sig}`;
  }

  async exists(bucket: "private" | "public", key: string): Promise<boolean> {
    try {
      await access(this.pathFor(bucket, key));
      return true;
    } catch {
      return false;
    }
  }

  // ---- signing for private URLs -------------------------------------------

  sign(key: string, exp: number): string {
    return createHmac("sha256", this.signSecret).update(`${key}:${exp}`).digest("hex").slice(0, 32);
  }

  verify(key: string, exp: number, sig: string): boolean {
    if (Date.now() / 1000 > exp) return false;
    return this.sign(key, exp) === sig;
  }
}
