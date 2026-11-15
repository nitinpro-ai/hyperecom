import { Injectable } from "@nestjs/common";
import { createHash, createHmac } from "node:crypto";
import type { StoragePort, PresignedUpload } from "./storage.port";

/**
 * S3-compatible storage (AWS S3, Cloudflare R2, MinIO) using AWS SigV4
 * presigned URLs implemented with node:crypto — NO aws-sdk dependency, so it
 * installs/builds cleanly under the Docker --ignore-scripts policy.
 *
 * Enabled by MEDIA_STORAGE_DRIVER=s3. Required env (packages/config enforces):
 *   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *   S3_BUCKET_PUBLIC, S3_BUCKET_PRIVATE, S3_FORCE_PATH_STYLE, CDN_BASE_URL.
 */
@Injectable()
export class S3StoragePort implements StoragePort {
  private readonly endpoint = (process.env.S3_ENDPOINT ?? "").replace(/\/$/, "");
  private readonly region = process.env.S3_REGION ?? "us-east-1";
  private readonly accessKey = process.env.S3_ACCESS_KEY_ID ?? "";
  private readonly secretKey = process.env.S3_SECRET_ACCESS_KEY ?? "";
  private readonly pathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true";
  private readonly cdnBase = process.env.CDN_BASE_URL ?? "";
  private readonly ttl = Number.parseInt(process.env.MEDIA_SIGNED_URL_TTL ?? "600", 10);
  private readonly buckets = {
    public: process.env.S3_BUCKET_PUBLIC ?? "apnacity-media",
    private: process.env.S3_BUCKET_PRIVATE ?? "apnacity-docs",
  };

  private bucketHost(bucket: string): { host: string; base: string } {
    const url = new URL(this.endpoint);
    if (this.pathStyle) {
      return { host: url.host, base: `${this.endpoint}/${bucket}` };
    }
    return { host: `${bucket}.${url.host}`, base: `${url.protocol}//${bucket}.${url.host}` };
  }

  /** AWS SigV4 query-presign for a single object + method. */
  private presign(method: "PUT" | "GET", bucket: "private" | "public", key: string): string {
    const b = this.buckets[bucket];
    const { host, base } = this.bucketHost(b);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const encKey = key.split("/").map(encodeURIComponent).join("/");

    const q = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${this.accessKey}/${scope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(this.ttl),
      "X-Amz-SignedHeaders": "host",
    });
    q.sort();
    const canonicalRequest = [
      method,
      `/${this.pathStyle ? `${b}/` : ""}${encKey}`,
      q.toString(),
      `host:${host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const canonicalHash = createHash("sha256").update(canonicalRequest).digest("hex");
    const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, canonicalHash].join("\n");

    const kDate = createHmac("sha256", `AWS4${this.secretKey}`).update(dateStamp).digest();
    const kRegion = createHmac("sha256", kDate).update(this.region).digest();
    const kService = createHmac("sha256", kRegion).update("s3").digest();
    const kSigning = createHmac("sha256", kService).update("aws4_request").digest();
    const signature = createHmac("sha256", kSigning).update(toSign).digest("hex");
    q.append("X-Amz-Signature", signature);
    return `${base}/${encKey}?${q.toString()}`;
  }

  async presignUpload(bucket: "private" | "public", key: string): Promise<PresignedUpload> {
    return { uploadUrl: this.presign("PUT", bucket, key), storageKey: key, expiresInSec: this.ttl };
  }

  async presignDownload(bucket: "private" | "public", key: string): Promise<string> {
    if (bucket === "public" && this.cdnBase) return `${this.cdnBase.replace(/\/$/, "")}/${key}`;
    return this.presign("GET", bucket, key);
  }

  async exists(bucket: "private" | "public", key: string): Promise<boolean> {
    const url = this.presign("GET", bucket, key);
    try {
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch {
      return false;
    }
  }
}
