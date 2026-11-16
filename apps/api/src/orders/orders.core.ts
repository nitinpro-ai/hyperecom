/**
 * M14 OMS — pure state machines (parent + seller/child order). No DB, fully
 * testable: the legal/illegal transition matrix. Spec: PART II M14 §state machines.
 */

export type ParentStatus = "PENDING_PAYMENT" | "PLACED" | "PARTIALLY_CANCELLED" | "COMPLETED" | "CANCELLED";

export type ChildStatus =
  | "NEW" | "ACCEPTED" | "REJECTED" | "PREPARING" | "READY" | "DISPATCHED"
  | "OUT_FOR_DELIVERY" | "DELIVERED" | "CLOSED" | "CANCELLED" | "RETURN_REQUESTED" | "RETURNED";

export type Actor = "CUSTOMER" | "SELLER" | "RIDER" | "ADMIN" | "SYSTEM";

export type ChildAction =
  | "ACCEPT" | "REJECT" | "PREPARING" | "READY" | "DISPATCH" | "OUT_FOR_DELIVERY"
  | "DELIVER" | "CLOSE" | "CANCEL" | "TIMEOUT" | "REQUEST_RETURN" | "COMPLETE_RETURN";

interface Transition {
  from: ChildStatus;
  to: ChildStatus;
  /** roles permitted to perform this transition */
  roles: Actor[];
}

/** Authoritative child transition table (spec M14). */
const CHILD: Record<ChildAction, Transition[]> = {
  ACCEPT: [{ from: "NEW", to: "ACCEPTED", roles: ["SELLER", "ADMIN"] }],
  REJECT: [{ from: "NEW", to: "REJECTED", roles: ["SELLER", "ADMIN"] }],
  TIMEOUT: [{ from: "NEW", to: "REJECTED", roles: ["SYSTEM"] }], // 10-min auto-reject
  PREPARING: [{ from: "ACCEPTED", to: "PREPARING", roles: ["SELLER"] }],
  READY: [{ from: "PREPARING", to: "READY", roles: ["SELLER"] }],
  DISPATCH: [{ from: "READY", to: "DISPATCHED", roles: ["SELLER", "RIDER"] }],
  OUT_FOR_DELIVERY: [{ from: "DISPATCHED", to: "OUT_FOR_DELIVERY", roles: ["RIDER", "SYSTEM"] }],
  DELIVER: [{ from: "OUT_FOR_DELIVERY", to: "DELIVERED", roles: ["RIDER", "SELLER"] }],
  CLOSE: [{ from: "DELIVERED", to: "CLOSED", roles: ["SYSTEM"] }],
  // pre-dispatch cancel (customer/seller/admin) — allowed before it leaves the shop
  CANCEL: [
    { from: "NEW", to: "CANCELLED", roles: ["CUSTOMER", "SELLER", "ADMIN"] },
    { from: "ACCEPTED", to: "CANCELLED", roles: ["CUSTOMER", "SELLER", "ADMIN"] },
    { from: "PREPARING", to: "CANCELLED", roles: ["SELLER", "ADMIN"] },
  ],
  REQUEST_RETURN: [{ from: "DELIVERED", to: "RETURN_REQUESTED", roles: ["CUSTOMER"] }],
  COMPLETE_RETURN: [{ from: "RETURN_REQUESTED", to: "RETURNED", roles: ["ADMIN", "SELLER"] }],
};

/** Statuses that free the reserved stock (reject/cancel/timeout). */
export const STOCK_RELEASING: ChildStatus[] = ["REJECTED", "CANCELLED"];
/** Status that consumes stock (the sale is final). */
export const STOCK_CONSUMING: ChildStatus[] = ["DISPATCHED"];
/** Statuses that trigger a refund (pre-delivery termination). */
export const REFUND_TRIGGERING: ChildStatus[] = ["REJECTED", "CANCELLED"];

export type TransitionResult =
  | { ok: true; to: ChildStatus; releasesStock: boolean; consumesStock: boolean; refunds: boolean }
  | { ok: false; reason: "ILLEGAL_TRANSITION" | "FORBIDDEN_ROLE" };

/** Validate + resolve a child transition (role × from→to). 409 on illegal. */
export function childTransition(from: ChildStatus, action: ChildAction, actor: Actor): TransitionResult {
  const candidates = CHILD[action] ?? [];
  const match = candidates.find((t) => t.from === from);
  if (!match) return { ok: false, reason: "ILLEGAL_TRANSITION" };
  if (!match.roles.includes(actor)) return { ok: false, reason: "FORBIDDEN_ROLE" };
  return {
    ok: true, to: match.to,
    releasesStock: STOCK_RELEASING.includes(match.to),
    consumesStock: STOCK_CONSUMING.includes(match.to),
    refunds: REFUND_TRIGGERING.includes(match.to),
  };
}

/**
 * Parent status derived from its children (spec):
 *  - all CANCELLED/REJECTED → CANCELLED
 *  - some (not all) terminated → PARTIALLY_CANCELLED
 *  - all CLOSED → COMPLETED
 *  - otherwise PLACED
 */
export function deriveParentStatus(children: ChildStatus[]): ParentStatus {
  if (children.length === 0) return "CANCELLED";
  const terminated = (s: ChildStatus) => s === "CANCELLED" || s === "REJECTED";
  if (children.every(terminated)) return "CANCELLED";
  if (children.every((s) => s === "CLOSED")) return "COMPLETED";
  if (children.some(terminated)) return "PARTIALLY_CANCELLED";
  return "PLACED";
}

/** Customer may free-cancel the whole order only while every child ∈ {NEW, ACCEPTED}. */
export function customerCanCancelAll(children: ChildStatus[]): boolean {
  return children.length > 0 && children.every((s) => s === "NEW" || s === "ACCEPTED");
}
