import { describe, expect, it } from "vitest";
import {
  buildOrderPosting, buildRefundPosting, isBalanced,
  resolveCommissionBp, computeSettlement, statementNo,
} from "./finance.core";

describe("finance.core — worked example (spec: ₹1000 item, ₹50 delivery, 5% comm, 2% gateway)", () => {
  const p = buildOrderPosting({ itemsTotalPaise: 100000, deliveryFeePaise: 5000, commissionRateBp: 500, gatewayFeeBp: 200 });

  it("computes commission ₹50, gateway ₹21, seller net ₹950 (to the paisa)", () => {
    expect(p.commissionPaise).toBe(5000);           // 5% of ₹1000
    expect(p.gatewayFeePaise).toBe(2100);           // 2% of ₹1050
    expect(p.sellerNetPaise).toBe(95000);           // ₹1000 − ₹50 commission = ₹950
  });

  it("the posting is balanced (debits == credits)", () => {
    expect(isBalanced(p.lines)).toBe(true);
    const d = p.lines.reduce((s, l) => s + l.debit, 0);
    const c = p.lines.reduce((s, l) => s + l.credit, 0);
    expect(d).toBe(c);
  });

  it("seller payable nets to ₹950 across the two SELLER_PAYABLE lines", () => {
    const sp = p.lines.filter((l) => l.account === "SELLER_PAYABLE");
    const net = sp.reduce((s, l) => s + l.credit - l.debit, 0);
    expect(net).toBe(95000);
  });
});

describe("finance.core — refund clawback", () => {
  it("reverses item + commission, stays balanced", () => {
    const lines = buildRefundPosting(100000, 500);
    expect(isBalanced(lines)).toBe(true);
    const comm = lines.find((l) => l.account === "COMMISSION_INCOME")!;
    expect(comm.debit).toBe(5000); // commission clawed back
  });
});

describe("finance.core — commission precedence", () => {
  const ov = [
    { shopId: "shopA", rateBp: 300 },
    { categoryId: "catX", shopId: null, rateBp: 400 },
    { cityId: "cityB", shopId: null, categoryId: null, rateBp: 600 },
  ];
  it("shop override wins", () => {
    expect(resolveCommissionBp(ov, { shopId: "shopA", categoryId: "catX", cityId: "cityB" })).toBe(300);
  });
  it("category next", () => {
    expect(resolveCommissionBp(ov, { shopId: "other", categoryId: "catX", cityId: "cityB" })).toBe(400);
  });
  it("city next, then default", () => {
    expect(resolveCommissionBp(ov, { shopId: "o", categoryId: "o", cityId: "cityB" })).toBe(600);
    expect(resolveCommissionBp(ov, { shopId: "o", categoryId: "o", cityId: "o" })).toBe(500);
  });
});

describe("finance.core — settlement", () => {
  it("net = gross − commission − refunds − TCS + adjustments", () => {
    const r = computeSettlement({ grossSalesPaise: 1000000, commissionPaise: 50000, deliveryPaise: 20000, refundsPaise: 30000, tcsBp: 100, adjustmentsPaise: 0 });
    expect(r.tcsPaise).toBe(10000);  // 1% of 10,00,000
    expect(r.netPaise).toBe(1000000 - 50000 - 30000 - 10000); // 910000
  });
  it("statement number format", () => {
    expect(statementNo(7, 2026)).toBe("STMT-2026-000007");
  });
});
