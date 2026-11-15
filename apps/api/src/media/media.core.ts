/**
 * M10 media — pure validation/planning core. No storage/DB so rules are fully
 * unit-testable. Spec: PART II M10.
 */

export type MediaKind =
  | "PRODUCT_IMAGE"
  | "LOGO"
  | "BANNER"
  | "POD"
  | "DOCUMENT"
  | "RETURN_PHOTO";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PRODUCT_IMAGES = 6;
export const DEFAULT_SHOP_QUOTA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
export const DERIVATIVE_SIZES = [256, 512, 1024] as const;

/** Allowed upload MIME types (image kinds). DOCUMENT also allows PDF. */
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOC_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function allowedMimesFor(kind: MediaKind): Set<string> {
  return kind === "DOCUMENT" ? DOC_MIMES : IMAGE_MIMES;
}

/** Private-bucket kinds: never publicly readable (signed URLs only). */
export function isPrivateKind(kind: MediaKind): boolean {
  return kind === "DOCUMENT" || kind === "POD" || kind === "RETURN_PHOTO";
}

export function bucketFor(kind: MediaKind): "private" | "public" {
  return isPrivateKind(kind) ? "private" : "public";
}

export type UploadCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "MIME_NOT_ALLOWED" | "TOO_LARGE" | "QUOTA_EXCEEDED" | "TOO_MANY_IMAGES";
    };

export interface UploadRequest {
  kind: MediaKind;
  mime: string;
  sizeBytes: number;
}

export interface QuotaContext {
  shopUsedBytes?: number;
  shopQuotaBytes?: number;
  existingProductImages?: number; // for PRODUCT_IMAGE count cap
}

/** Validate an upload request BEFORE issuing a presigned URL. */
export function checkUpload(req: UploadRequest, ctx: QuotaContext = {}): UploadCheck {
  if (!allowedMimesFor(req.kind).has(req.mime)) return { ok: false, reason: "MIME_NOT_ALLOWED" };
  if (req.sizeBytes <= 0 || req.sizeBytes > MAX_IMAGE_BYTES) return { ok: false, reason: "TOO_LARGE" };

  if (req.kind === "PRODUCT_IMAGE" && (ctx.existingProductImages ?? 0) >= MAX_PRODUCT_IMAGES) {
    return { ok: false, reason: "TOO_MANY_IMAGES" };
  }
  const quota = ctx.shopQuotaBytes ?? DEFAULT_SHOP_QUOTA_BYTES;
  if ((ctx.shopUsedBytes ?? 0) + req.sizeBytes > quota) {
    return { ok: false, reason: "QUOTA_EXCEEDED" };
  }
  return { ok: true };
}

/**
 * Content-sniffing: verify the declared MIME against magic bytes (anti-spoof).
 * Returns the detected type or null. Reject when detected !== declared.
 */
export function sniffMime(header: Uint8Array): string | null {
  // JPEG: FF D8 FF
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return "image/jpeg";
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    header.length >= 8 &&
    header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47 &&
    header[4] === 0x0d && header[5] === 0x0a && header[6] === 0x1a && header[7] === 0x0a
  ) {
    return "image/png";
  }
  // WEBP: "RIFF"...."WEBP"
  if (
    header.length >= 12 &&
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  ) {
    return "image/webp";
  }
  // PDF: "%PDF"
  if (header.length >= 4 && header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
    return "application/pdf";
  }
  return null;
}

/** True when the real content matches the declared MIME (spoof check). */
export function contentMatchesDeclared(declaredMime: string, header: Uint8Array): boolean {
  const detected = sniffMime(header);
  return detected !== null && detected === declaredMime;
}

/** Storage key for an original upload. */
export function storageKey(kind: MediaKind, mediaId: string, mime: string): string {
  const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1] ?? "bin";
  return `${bucketFor(kind)}/${kind.toLowerCase()}/${mediaId}/original.${ext}`;
}

/** Derivative keys for image kinds (none for DOCUMENT/PDF). */
export function derivativePlan(kind: MediaKind, mediaId: string): Record<string, string> {
  if (kind === "DOCUMENT") return {};
  const out: Record<string, string> = {};
  for (const size of DERIVATIVE_SIZES) {
    out[String(size)] = `${bucketFor(kind)}/${kind.toLowerCase()}/${mediaId}/${size}.webp`;
  }
  return out;
}
