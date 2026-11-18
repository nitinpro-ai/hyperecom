"use client";
import { createApiClient } from "@apnacity/api-client";

/** Seller-portal client session (localStorage, dev). */
const KEY = "apnacity.seller.session";

export interface Session {
  accessToken: string;
  refreshToken: string;
  family: string;
  user: { id: string; name: string; roles: string[] };
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const r = localStorage.getItem(KEY);
    return r ? (JSON.parse(r) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://192.168.2.224:30400";
export const WEB_MARKETPLACE_URL =
  process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://192.168.2.224:30280";

export function clientApi() {
  return createApiClient({
    baseUrl: BASE,
    getAccessToken: () => getSession()?.accessToken,
  });
}

export const inr = (paise: number | null | undefined): string =>
  paise == null ? "₹0" : "₹" + Math.round(paise / 100).toLocaleString("en-IN");

export const discountPct = (pricePaise: number, mrpPaise: number): number =>
  mrpPaise <= 0 || pricePaise >= mrpPaise
    ? 0
    : Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);

