import { createApiClient } from "@apnacity/api-client";

/**
 * Server-side API client for the web app. Base URL from env (defaults to the
 * dev API). Reads are public (no token). During local dev before the API is
 * redeployed, callers use `safe()` to fall back to demo data so pages render.
 */
const baseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

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
