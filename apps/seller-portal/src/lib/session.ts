"use client";
import { createApiClient } from "@apnacity/api-client";

/** Seller-portal client session (localStorage, dev). Mirrors the web app's lib. */
const KEY = "apnacity.seller.session";

export interface Session {
  accessToken: string; refreshToken: string; family: string;
  user: { id: string; name: string; roles: string[] };
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function setSession(s: Session): void { localStorage.setItem(KEY, JSON.stringify(s)); }
export function clearSession(): void { localStorage.removeItem(KEY); }

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
export function clientApi() {
  return createApiClient({ baseUrl: BASE, getAccessToken: () => getSession()?.accessToken });
}
