import { createApiClient } from "@apnacity/api-client";

/**
 * Server-side API client for the web app. Base URL resolution (first set wins):
 *   1. API_BASE_URL            — explicit server-to-server override (e.g. in-cluster svc)
 *   2. NEXT_PUBLIC_API_BASE_URL — baked at build (dev cluster NodePort); works even when
 *      the web pod has no env set, which is why server reads were falling back to demo.
 *   3. http://localhost:4000   — local dev default
 * Reads are public (no token). Callers use `safe()` to fall back to demo data.
 */
const baseUrl =
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

export const api = createApiClient({ baseUrl });

/** Run an API read; return `fallback` if it throws (API down / not deployed). */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const inr = (paise: number | null | undefined): string =>
  paise == null ? "—" : "₹" + Math.round(paise / 100).toLocaleString("en-IN");

export const discountPct = (pricePaise: number, mrpPaise: number): number =>
  mrpPaise <= 0 ? 0 : Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
