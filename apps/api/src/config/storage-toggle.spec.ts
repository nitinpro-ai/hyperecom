import { describe, expect, it } from "vitest";
import { loadEnv } from "@apnacity/config";

/**
 * Verifies the MEDIA_STORAGE_DRIVER toggle (dev disk vs prod S3) and that S3
 * credentials are enforced ONLY when the S3 driver is enabled.
 */
const base = {
  TENANT_RESOLVE_HMAC_SECRET: "0123456789abcdef",
  DATABASE_URL: "postgresql://x",
  JWT_ACCESS_SECRET: "0123456789abcdef",
  REFRESH_SECRET: "0123456789abcdef",
  OTP_HASH_PEPPER: "0123456789abcdef",
};

describe("MEDIA_STORAGE_DRIVER toggle", () => {
  it("defaults to disk and needs NO S3 credentials", () => {
    const env = loadEnv({ ...base });
    expect(env.MEDIA_STORAGE_DRIVER).toBe("disk");
  });

  it("disk driver boots with no S3 creds", () => {
    const env = loadEnv({ ...base, MEDIA_STORAGE_DRIVER: "disk" });
    expect(env.MEDIA_STORAGE_DRIVER).toBe("disk");
  });

  it("s3 driver REFUSES to boot without S3 credentials", () => {
    expect(() => loadEnv({ ...base, MEDIA_STORAGE_DRIVER: "s3" })).toThrow(
      /MEDIA_STORAGE_DRIVER=s3/,
    );
  });

  it("s3 driver boots once credentials + buckets are present", () => {
    const env = loadEnv({
      ...base,
      MEDIA_STORAGE_DRIVER: "s3",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
      S3_BUCKET_PUBLIC: "apnacity-media",
      S3_BUCKET_PRIVATE: "apnacity-docs",
    });
    expect(env.MEDIA_STORAGE_DRIVER).toBe("s3");
    expect(env.S3_ACCESS_KEY_ID).toBe("key");
  });
});
