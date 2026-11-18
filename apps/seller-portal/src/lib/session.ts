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

export async function logoutSession(): Promise<void> {
  const cur = getSession();
  clearSession();
  if (cur?.family) {
    try {
      await fetch(`${BASE}/v1/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ family: cur.family }),
      });
    } catch {
      // Ignore network errors during logout cleanup
    }
  }
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://192.168.2.224:30400";
export const WEB_MARKETPLACE_URL =
  process.env.NEXT_PUBLIC_WEB_BASE_URL ?? "http://192.168.2.224:30280";

let refreshInFlight: Promise<string | undefined> | null = null;

async function doRefreshAccessToken(): Promise<string | undefined> {
  const cur = getSession();
  if (!cur?.refreshToken || !cur?.family) {
    clearSession();
    return undefined;
  }
  try {
    const res = await fetch(`${BASE}/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ family: cur.family, refreshToken: cur.refreshToken }),
    });
    if (!res.ok) {
      clearSession();
      return undefined;
    }
    const next = (await res.json()) as Session;
    if (next?.accessToken) {
      setSession(next);
      return next.accessToken;
    }
    clearSession();
    return undefined;
  } catch {
    return undefined;
  }
}

export function clientApi() {
  return createApiClient({
    baseUrl: BASE,
    getAccessToken: () => getSession()?.accessToken,
    refreshAccessToken: () => {
      if (!refreshInFlight) {
        refreshInFlight = doRefreshAccessToken().finally(() => {
          refreshInFlight = null;
        });
      }
      return refreshInFlight;
    },
  });
}

export const inr = (paise: number | null | undefined): string =>
  paise == null ? "₹0" : "₹" + Math.round(paise / 100).toLocaleString("en-IN");

export const discountPct = (pricePaise: number, mrpPaise: number): number =>
  mrpPaise <= 0 || pricePaise >= mrpPaise
    ? 0
    : Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);

