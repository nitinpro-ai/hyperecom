/**
 * Shared cross-app types. In Step 4+, most API types are GENERATED from the
 * NestJS OpenAPI spec into @apnacity/api-client; this package holds
 * hand-written types shared by web/mobile UIs that don't come from the API.
 */

export type Locale = "EN" | "HI";

/** Tenant context resolved from the storefront host (spec/02 §2.2). */
export interface TenantContext {
  shopId: string;
  slug: string;
  cityId: string;
  shopName: string;
}

/** City selection stored in cookie/profile. */
export interface CitySelection {
  cityId: string;
  cityName: string;
  stateId: string;
  stateName: string;
  source: "gps" | "pincode" | "manual";
}

/** Money is ALWAYS integer paise; format on the edge only. */
export function formatINR(paise: number, locale: Locale = "EN"): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat(locale === "HI" ? "hi-IN" : "en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(rupees);
}
