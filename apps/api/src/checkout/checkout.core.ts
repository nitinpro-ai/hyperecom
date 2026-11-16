/**
 * Step 11 pure cores — quote math + coupon validation. No DB. Money = paise.
 * Spec: PART II M13 (quote) + M20 (coupon stack).
 */

export interface QuoteLineInput {
  shopId: string;
  listingVariantId: string;
  quantity: number;
  unitPricePaise: number;
  taxRateBp: number; // basis points (e.g. 500 = 5%)
}

export interface ShopGroup {
  shopId: string;
  itemsTotalPaise: number;
  taxPaise: number;
  deliveryFeePaise: number;
}

export interface QuoteTotals {
  shopGroups: ShopGroup[];
  itemsTotalPaise: number;
  deliveryTotalPaise: number;
  taxTotalPaise: number;
  discountPaise: number;
  grandTotalPaise: number;
}

/**
 * Compute a quote: group lines by shop, per-shop items + tax + delivery fee,
 * then apply a validated discount. Tax is price-inclusive in display but tracked.
 */
export function computeQuote(
  lines: QuoteLineInput[],
  deliveryFeePaiseByShop: Record<string, number>,
  discountPaise = 0,
): QuoteTotals {
  const groups = new Map<string, ShopGroup>();
  for (const l of lines) {
    const g = groups.get(l.shopId) ?? {
      shopId: l.shopId, itemsTotalPaise: 0, taxPaise: 0,
      deliveryFeePaise: deliveryFeePaiseByShop[l.shopId] ?? 0,
    };
    const lineTotal = l.unitPricePaise * l.quantity;
    g.itemsTotalPaise += lineTotal;
    // tax-inclusive: tax portion = total - total/(1+rate)
    g.taxPaise += Math.round(lineTotal - lineTotal / (1 + l.taxRateBp / 10000));
    groups.set(l.shopId, g);
  }
  const shopGroups = [...groups.values()];
  const itemsTotalPaise = shopGroups.reduce((s, g) => s + g.itemsTotalPaise, 0);
  const deliveryTotalPaise = shopGroups.reduce((s, g) => s + g.deliveryFeePaise, 0);
  const taxTotalPaise = shopGroups.reduce((s, g) => s + g.taxPaise, 0);
  const cappedDiscount = Math.min(discountPaise, itemsTotalPaise); // never below 0
  const grandTotalPaise = itemsTotalPaise + deliveryTotalPaise - cappedDiscount;
  return {
    shopGroups, itemsTotalPaise, deliveryTotalPaise, taxTotalPaise,
    discountPaise: cappedDiscount, grandTotalPaise,
  };
}

// ---- Coupon validation (M20) ----------------------------------------------

export interface CouponDef {
  scope: "PLATFORM" | "CITY" | "SHOP";
  cityId?: string | null;
  shopId?: string | null;
  type: "PERCENT" | "FLAT" | "FREE_DELIVERY";
  valueBp?: number | null;
  valuePaise?: number | null;
  minOrderPaise: number;
  maxDiscountPaise?: number | null;
  usageLimit?: number | null;
  perUserLimit: number;
  validFrom?: Date | null;
  validTo?: Date | null;
  isActive: boolean;
}

export interface CouponContext {
  itemsTotalPaise: number;
  deliveryTotalPaise: number;
  cityId: string;
  shopIds: string[];
  now: Date;
  totalRedemptions: number;
  userRedemptions: number;
}

export type CouponResult =
  | { ok: true; discountPaise: number }
  | { ok: false; reason: "INACTIVE" | "OUT_OF_WINDOW" | "MIN_ORDER" | "SCOPE" | "USAGE_LIMIT" | "USER_LIMIT" };

/** Validation stack: active → window → scope → min-order → limits → compute. */
export function validateCoupon(c: CouponDef, ctx: CouponContext): CouponResult {
  if (!c.isActive) return { ok: false, reason: "INACTIVE" };
  if (c.validFrom && ctx.now < c.validFrom) return { ok: false, reason: "OUT_OF_WINDOW" };
  if (c.validTo && ctx.now > c.validTo) return { ok: false, reason: "OUT_OF_WINDOW" };
  if (c.scope === "CITY" && c.cityId !== ctx.cityId) return { ok: false, reason: "SCOPE" };
  if (c.scope === "SHOP" && !(c.shopId && ctx.shopIds.includes(c.shopId))) return { ok: false, reason: "SCOPE" };
  if (ctx.itemsTotalPaise < c.minOrderPaise) return { ok: false, reason: "MIN_ORDER" };
  if (c.usageLimit != null && ctx.totalRedemptions >= c.usageLimit) return { ok: false, reason: "USAGE_LIMIT" };
  if (ctx.userRedemptions >= c.perUserLimit) return { ok: false, reason: "USER_LIMIT" };

  let discount = 0;
  if (c.type === "PERCENT") {
    discount = Math.round((ctx.itemsTotalPaise * (c.valueBp ?? 0)) / 10000);
    if (c.maxDiscountPaise != null) discount = Math.min(discount, Number(c.maxDiscountPaise));
  } else if (c.type === "FLAT") {
    discount = Number(c.valuePaise ?? 0);
  } else if (c.type === "FREE_DELIVERY") {
    discount = ctx.deliveryTotalPaise; // applies to delivery (one shop group in practice)
  }
  discount = Math.min(discount, ctx.itemsTotalPaise + ctx.deliveryTotalPaise);
  return { ok: true, discountPaise: discount };
}

/** Human order number: APN-YYYY-NNNNNN. */
export function orderNo(seq: number, year = new Date().getUTCFullYear()): string {
  return `APN-${year}-${String(seq).padStart(6, "0")}`;
}
