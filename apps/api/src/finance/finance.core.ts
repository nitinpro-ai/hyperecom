/**
 * M16 finance — pure posting math + settlement aggregation. No DB. Money = paise.
 * Spec: PART II M16 (worked example). The ledger service persists what this computes.
 */

export interface LedgerLine {
  account: string; // logical account key, e.g. "SELLER_PAYABLE"
  debit: number;   // paise
  credit: number;  // paise
}

export interface OrderPostingInput {
  itemsTotalPaise: number;
  deliveryFeePaise: number;
  commissionRateBp: number; // basis points, e.g. 500 = 5%
  gatewayFeeBp: number;     // e.g. 200 = 2%
}

export interface OrderPosting {
  lines: LedgerLine[];
  commissionPaise: number;
  gatewayFeePaise: number;
  sellerNetPaise: number; // what the seller is owed after commission (pre-payout)
}

/**
 * Build the balanced double-entry posting for a captured order (spec example:
 * ₹1000 item + ₹50 delivery, 5% commission, 2% gateway fee).
 *   DR CustomerReceivable (items+delivery) / CR SellerPayable (items) + CR DeliveryIncome
 *   DR CommissionIncome / CR SellerPayable   (commission reduces seller payable)
 *   DR GatewayFee / CR Clearing
 * Returns balanced lines (SUM debit == SUM credit) and the derived amounts.
 */
export function buildOrderPosting(i: OrderPostingInput): OrderPosting {
  const gross = i.itemsTotalPaise + i.deliveryFeePaise;
  const commission = Math.round((i.itemsTotalPaise * i.commissionRateBp) / 10000);
  const gatewayFee = Math.round((gross * i.gatewayFeeBp) / 10000);
  const sellerNet = i.itemsTotalPaise - commission;

  const lines: LedgerLine[] = [
    // capture: customer receivable cleared → seller payable (items) + delivery income
    { account: "CUSTOMER_RECEIVABLE", debit: gross, credit: 0 },
    { account: "SELLER_PAYABLE", debit: 0, credit: i.itemsTotalPaise },
    { account: "DELIVERY_INCOME", debit: 0, credit: i.deliveryFeePaise },
    // commission: platform income, reduces seller payable
    { account: "SELLER_PAYABLE", debit: commission, credit: 0 },
    { account: "COMMISSION_INCOME", debit: 0, credit: commission },
    // gateway fee: platform expense vs clearing
    { account: "GATEWAY_FEE", debit: gatewayFee, credit: 0 },
    { account: "CLEARING", debit: 0, credit: gatewayFee },
  ];

  return { lines, commissionPaise: commission, gatewayFeePaise: gatewayFee, sellerNetPaise: sellerNet };
}

/** Refund clawback reverses item + commission for a returned item (spec T-1005). */
export function buildRefundPosting(itemPaise: number, commissionRateBp: number): LedgerLine[] {
  const commission = Math.round((itemPaise * commissionRateBp) / 10000);
  return [
    { account: "SELLER_PAYABLE", debit: itemPaise - commission, credit: 0 },
    { account: "COMMISSION_INCOME", debit: commission, credit: 0 },
    { account: "REFUND_CLAIM", debit: 0, credit: itemPaise },
  ];
}

/** A posting is valid only when total debits == total credits (the invariant). */
export function isBalanced(lines: LedgerLine[]): boolean {
  const d = lines.reduce((s, l) => s + l.debit, 0);
  const c = lines.reduce((s, l) => s + l.credit, 0);
  return d === c;
}

export function resolveCommissionBp(
  overrides: { shopId?: string | null; categoryId?: string | null; cityId?: string | null; rateBp: number }[],
  ctx: { shopId: string; categoryId: string; cityId: string },
  defaultBp = 500,
): number {
  // precedence: shop override > category > city > default
  const byShop = overrides.find((o) => o.shopId === ctx.shopId);
  if (byShop) return byShop.rateBp;
  const byCat = overrides.find((o) => o.categoryId === ctx.categoryId && !o.shopId);
  if (byCat) return byCat.rateBp;
  const byCity = overrides.find((o) => o.cityId === ctx.cityId && !o.shopId && !o.categoryId);
  if (byCity) return byCity.rateBp;
  return defaultBp;
}

export interface SettlementInput {
  grossSalesPaise: number;
  commissionPaise: number;
  deliveryPaise: number;
  refundsPaise: number;
  tcsBp?: number; // tax collected at source, e.g. 100 = 1%
  adjustmentsPaise?: number;
}

export interface SettlementTotals {
  tcsPaise: number;
  netPaise: number;
}

/** Net payout = gross − commission − refunds − TCS + adjustments (delivery billed separately). */
export function computeSettlement(i: SettlementInput): SettlementTotals {
  const tcs = Math.round((i.grossSalesPaise * (i.tcsBp ?? 0)) / 10000);
  const net = i.grossSalesPaise - i.commissionPaise - i.refundsPaise - tcs + (i.adjustmentsPaise ?? 0);
  return { tcsPaise: tcs, netPaise: net };
}

export function statementNo(seq: number, year = new Date().getUTCFullYear()): string {
  return `STMT-${year}-${String(seq).padStart(6, "0")}`;
}
