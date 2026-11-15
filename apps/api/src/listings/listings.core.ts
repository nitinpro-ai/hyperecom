/**
 * M08 listings — pure cores: publish-validation matrix, price rules, status.
 * No DB. Spec: PART II M08.
 */

export type ListingStatus = "DRAFT" | "PAUSED" | "ACTIVE" | "OUT_OF_STOCK" | "REJECTED";

export interface PublishContext {
  imageCount: number;
  requiredAttrsMissing: string[]; // keys of required attrs not satisfied
  variants: Array<{ pricePaise: number; mrpPaise: number; stock: number }>;
}

export type PublishValidation =
  | { ok: true }
  | { ok: false; errors: Array<{ field: string; message: string }> };

/**
 * Publish gate (spec): requires ≥1 image + required attributes + a price +
 * stock. Returns per-field errors (→ 422) when not satisfiable.
 */
export function validatePublish(ctx: PublishContext): PublishValidation {
  const errors: Array<{ field: string; message: string }> = [];
  if (ctx.imageCount < 1) errors.push({ field: "images", message: "at least one image required" });
  for (const key of ctx.requiredAttrsMissing) {
    errors.push({ field: `attributes.${key}`, message: "required attribute missing" });
  }
  if (ctx.variants.length === 0) {
    errors.push({ field: "variants", message: "at least one variant required" });
  }
  ctx.variants.forEach((v, i) => {
    if (v.pricePaise <= 0) errors.push({ field: `variants[${i}].price`, message: "price required" });
    if (v.pricePaise > v.mrpPaise) {
      errors.push({ field: `variants[${i}].price`, message: "price cannot exceed MRP" });
    }
    if (v.stock < 0) errors.push({ field: `variants[${i}].stock`, message: "stock cannot be negative" });
  });
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function priceWithinMrp(pricePaise: number, mrpPaise: number): boolean {
  return pricePaise > 0 && pricePaise <= mrpPaise;
}

/**
 * Status after a stock/availability change (spec): available 0 → OUT_OF_STOCK;
 * restored (>0) from OUT_OF_STOCK → ACTIVE. Other statuses unchanged by stock.
 */
export function statusForAvailability(current: ListingStatus, available: number): ListingStatus {
  if (current === "ACTIVE" && available <= 0) return "OUT_OF_STOCK";
  if (current === "OUT_OF_STOCK" && available > 0) return "ACTIVE";
  return current;
}

/** Discount % off MRP (for display / comparison). */
export function discountPct(pricePaise: number, mrpPaise: number): number {
  if (mrpPaise <= 0) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}
