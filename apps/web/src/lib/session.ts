"use client";
import { createApiClient } from "@apnacity/api-client";

/**
 * Client-side session + API for the web app. DEV token storage = localStorage
 * (LAN-only; prod should move to httpOnly cookies). The browser attaches the
 * access token via createApiClient({ getAccessToken }).
 */
const KEY = "apnacity.session";
const CITY_KEY = "apnacity.cityId";

export interface Session {
  accessToken: string;
  refreshToken: string;
  family: string;
  user: { id: string; name: string; roles: string[] };
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

/** The customer's city for cart/checkout scoping (defaults to Bijnor pilot). */
export function getCityId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(CITY_KEY) ?? "";
}
export function setCityId(id: string): void {
  localStorage.setItem(CITY_KEY, id);
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** API client bound to the current session token (for client components). */
export function clientApi() {
  return createApiClient({ baseUrl: BASE, getAccessToken: () => getSession()?.accessToken });
}
