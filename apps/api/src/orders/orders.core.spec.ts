import { describe, expect, it } from "vitest";
import { childTransition, deriveParentStatus, customerCanCancelAll, type ChildStatus } from "./orders.core";

describe("childTransition — legal happy path", () => {
  it("NEW→ACCEPTED→PREPARING→READY→DISPATCHED→OUT_FOR_DELIVERY→DELIVERED→CLOSED", () => {
    expect(childTransition("NEW", "ACCEPT", "SELLER").ok).toBe(true);
    expect(childTransition("ACCEPTED", "PREPARING", "SELLER").ok).toBe(true);
    expect(childTransition("PREPARING", "READY", "SELLER").ok).toBe(true);
    const disp = childTransition("READY", "DISPATCH", "SELLER");
    expect(disp.ok && disp.consumesStock).toBe(true); // dispatch consumes stock
    expect(childTransition("DISPATCHED", "OUT_FOR_DELIVERY", "RIDER").ok).toBe(true);
    expect(childTransition("OUT_FOR_DELIVERY", "DELIVER", "RIDER").ok).toBe(true);
    expect(childTransition("DELIVERED", "CLOSE", "SYSTEM").ok).toBe(true);
  });
});

describe("childTransition — reject / timeout / cancel release stock + refund", () => {
  it("seller REJECT from NEW releases stock + refunds", () => {
    const r = childTransition("NEW", "REJECT", "SELLER");
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.releasesStock).toBe(true); expect(r.refunds).toBe(true); }
  });
  it("10-min TIMEOUT auto-rejects (SYSTEM only) and releases + refunds", () => {
    const r = childTransition("NEW", "TIMEOUT", "SYSTEM");
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.to).toBe("REJECTED"); expect(r.releasesStock).toBe(true); expect(r.refunds).toBe(true); }
    // a seller cannot fire TIMEOUT
    expect(childTransition("NEW", "TIMEOUT", "SELLER")).toEqual({ ok: false, reason: "FORBIDDEN_ROLE" });
  });
  it("pre-dispatch CANCEL allowed; post-dispatch CANCEL illegal", () => {
    expect(childTransition("ACCEPTED", "CANCEL", "CUSTOMER").ok).toBe(true);
    expect(childTransition("DISPATCHED", "CANCEL", "CUSTOMER")).toEqual({ ok: false, reason: "ILLEGAL_TRANSITION" });
  });
});

describe("childTransition — illegal / forbidden", () => {
  it("rejects skipping states", () => {
    expect(childTransition("NEW", "DISPATCH", "SELLER")).toEqual({ ok: false, reason: "ILLEGAL_TRANSITION" });
    expect(childTransition("ACCEPTED", "DELIVER", "RIDER")).toEqual({ ok: false, reason: "ILLEGAL_TRANSITION" });
  });
  it("rejects wrong role (customer cannot accept)", () => {
    expect(childTransition("NEW", "ACCEPT", "CUSTOMER")).toEqual({ ok: false, reason: "FORBIDDEN_ROLE" });
  });
});

describe("deriveParentStatus", () => {
  const s = (...a: ChildStatus[]) => a;
  it("all closed → COMPLETED", () => expect(deriveParentStatus(s("CLOSED", "CLOSED"))).toBe("COMPLETED"));
  it("all cancelled/rejected → CANCELLED", () => expect(deriveParentStatus(s("CANCELLED", "REJECTED"))).toBe("CANCELLED"));
  it("some terminated → PARTIALLY_CANCELLED", () => expect(deriveParentStatus(s("CANCELLED", "ACCEPTED"))).toBe("PARTIALLY_CANCELLED"));
  it("in progress → PLACED", () => expect(deriveParentStatus(s("ACCEPTED", "PREPARING"))).toBe("PLACED"));
});

describe("customerCanCancelAll", () => {
  it("true only while all children NEW/ACCEPTED", () => {
    expect(customerCanCancelAll(["NEW", "ACCEPTED"])).toBe(true);
    expect(customerCanCancelAll(["NEW", "PREPARING"])).toBe(false);
    expect(customerCanCancelAll([])).toBe(false);
  });
});
