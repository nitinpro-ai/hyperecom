import { describe, expect, it } from "vitest";
import {
  decideSend, fallbackChannel, renderTemplate,
  isWithinReturnWindow, shouldAutoApprove,
  slaDueAt, freezesRefund, ticketNo,
} from "./step14.core";

describe("M22 notifications — decideSend", () => {
  const base = { channel: "SMS" as const, topic: "ORDERS" as const, dltTemplateId: "DLT123", optedIn: true, nowIstHour: 12 };
  it("SMS without DLT id fails closed", () => {
    expect(decideSend({ ...base, dltTemplateId: "" })).toEqual({ send: false, reason: "FAIL_CLOSED_NO_DLT" });
    expect(decideSend({ ...base, dltTemplateId: null })).toEqual({ send: false, reason: "FAIL_CLOSED_NO_DLT" });
  });
  it("ORDERS topic always sends even if not opted in", () => {
    expect(decideSend({ ...base, topic: "ORDERS", optedIn: false })).toEqual({ send: true });
  });
  it("PROMOS respects opt-out", () => {
    expect(decideSend({ ...base, channel: "PUSH", topic: "PROMOS", optedIn: false })).toEqual({ send: false, reason: "OPTED_OUT" });
  });
  it("PROMOS suppressed during quiet hours (21:00–08:00 IST)", () => {
    expect(decideSend({ ...base, channel: "PUSH", topic: "PROMOS", optedIn: true, nowIstHour: 22 })).toEqual({ send: false, reason: "QUIET_HOURS" });
    expect(decideSend({ ...base, channel: "PUSH", topic: "PROMOS", optedIn: true, nowIstHour: 10 })).toEqual({ send: true });
  });
  it("fallback channel push→sms→email", () => {
    expect(fallbackChannel(["EMAIL", "SMS", "PUSH"])).toBe("PUSH");
    expect(fallbackChannel(["EMAIL", "SMS"])).toBe("SMS");
    expect(fallbackChannel(["EMAIL"])).toBe("EMAIL");
  });
  it("renders template vars", () => {
    expect(renderTemplate("Order {{no}} is {{status}}", { no: "APN-1", status: "placed" })).toBe("Order APN-1 is placed");
  });
});

describe("M19 returns — window + auto-approve", () => {
  const delivered = new Date("2026-06-01T00:00:00Z");
  it("within window passes; expired blocks; non-returnable blocks", () => {
    expect(isWithinReturnWindow({ deliveredAt: delivered, now: new Date("2026-06-05"), windowDays: 7, isNonReturnable: false })).toEqual({ ok: true });
    expect(isWithinReturnWindow({ deliveredAt: delivered, now: new Date("2026-06-10"), windowDays: 7, isNonReturnable: false })).toEqual({ ok: false, reason: "WINDOW_EXPIRED" });
    expect(isWithinReturnWindow({ deliveredAt: delivered, now: new Date("2026-06-02"), windowDays: 7, isNonReturnable: true })).toEqual({ ok: false, reason: "NON_RETURNABLE" });
  });
  it("auto-approves cheap size/mind returns with no abuse", () => {
    expect(shouldAutoApprove({ reason: "SIZE_ISSUE", itemValuePaise: 40000, userReturns: 0, userOrders: 5 })).toBe(true);
    expect(shouldAutoApprove({ reason: "CHANGED_MIND", itemValuePaise: 50000, userReturns: 1, userOrders: 10 })).toBe(true);
  });
  it("manual review for expensive, wrong reason, or abuse history", () => {
    expect(shouldAutoApprove({ reason: "SIZE_ISSUE", itemValuePaise: 60000, userReturns: 0, userOrders: 5 })).toBe(false); // >₹500
    expect(shouldAutoApprove({ reason: "DAMAGED", itemValuePaise: 40000, userReturns: 0, userOrders: 5 })).toBe(false); // reason
    expect(shouldAutoApprove({ reason: "SIZE_ISSUE", itemValuePaise: 40000, userReturns: 4, userOrders: 10 })).toBe(false); // abuse
  });
});

describe("M23 support — SLA + dispute freeze", () => {
  const from = new Date("2026-06-01T00:00:00Z");
  it("SLA due by priority", () => {
    expect(slaDueAt("URGENT", from).getTime() - from.getTime()).toBe(2 * 3600e3);
    expect(slaDueAt("LOW", from).getTime() - from.getTime()).toBe(48 * 3600e3);
  });
  it("open dispute types freeze refunds", () => {
    expect(freezesRefund("RETURN_DISPUTE", "OPEN")).toBe(true);
    expect(freezesRefund("REFUND_ESCALATION", "IN_PROGRESS")).toBe(true);
    expect(freezesRefund("RETURN_DISPUTE", "RESOLVED")).toBe(false); // resolved → unfrozen
    expect(freezesRefund("DELIVERY_ISSUE", "OPEN")).toBe(false); // not a dispute type
  });
  it("ticket number format", () => {
    expect(ticketNo(42, 2026)).toBe("TKT-2026-000042");
  });
});
