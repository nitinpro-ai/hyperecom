/**
 * M25 analytics — pure helpers: PII stripping + rollup scoping. No DB.
 * Spec: PART II M25 (no raw PII; seller sees own shop only).
 */

export type EventType =
  | "SEARCH" | "PRODUCT_VIEW" | "ADD_TO_CART" | "CHECKOUT_START"
  | "ORDER_PLACED" | "DELIVERY_COMPLETED" | "SEARCH_MISS";

/** Keys that must NEVER be stored in an analytics payload (PII). */
const PII_KEYS = new Set(["phone", "email", "name", "address", "line1", "line2", "upiId", "pan", "gstin", "lat", "lng"]);

/** Strip PII keys from an event payload (defense in depth — spec: no raw PII). */
export function stripPii(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (PII_KEYS.has(k)) continue;
    out[k] = v;
  }
  return out;
}

/** Day bucket (UTC date) for a timestamp — the rollup grain. */
export function dayBucket(ts: Date): string {
  return ts.toISOString().slice(0, 10); // YYYY-MM-DD
}

export type Scope = "PLATFORM" | "CITY" | "SHOP";

/**
 * Which rollup scopes an event contributes to: always PLATFORM; CITY if it has a
 * city; SHOP if it has a shop. Returns [scope, scopeId|null] pairs.
 */
export function rollupScopes(ev: { cityId?: string | null; shopId?: string | null }): Array<[Scope, string | null]> {
  const scopes: Array<[Scope, string | null]> = [["PLATFORM", null]];
  if (ev.cityId) scopes.push(["CITY", ev.cityId]);
  if (ev.shopId) scopes.push(["SHOP", ev.shopId]);
  return scopes;
}

/**
 * Authorise a dashboard read: SELLER may only read SHOP scope for a shop they
 * own; CITY_ADMIN only their city; SUPER_ADMIN anything. Returns the enforced
 * (scope, scopeId) or null if denied.
 */
export function authorizeDashboard(
  role: "SUPER_ADMIN" | "CITY_ADMIN" | "SELLER" | string,
  requested: { scope: Scope; scopeId?: string | null },
  ctx: { cityId?: string; shopIds?: string[] },
): { scope: Scope; scopeId: string | null } | null {
  if (role === "SUPER_ADMIN") return { scope: requested.scope, scopeId: requested.scopeId ?? null };
  if (role === "CITY_ADMIN") {
    if (requested.scope === "PLATFORM") return null;
    if (requested.scope === "CITY" && requested.scopeId === ctx.cityId) return { scope: "CITY", scopeId: ctx.cityId ?? null };
    if (requested.scope === "SHOP") return { scope: "SHOP", scopeId: requested.scopeId ?? null }; // city admin can view shops in-city (city filter applied by caller)
    return null;
  }
  if (role === "SELLER") {
    if (requested.scope === "SHOP" && requested.scopeId && ctx.shopIds?.includes(requested.scopeId)) {
      return { scope: "SHOP", scopeId: requested.scopeId };
    }
    return null; // sellers can ONLY see their own shop
  }
  return null;
}
