/**
 * Step 14 pure cores — notifications gating, returns policy, support SLA. No DB.
 * Spec: PART II M22 / M19 / M23.
 */

// ---- M22 notifications ----------------------------------------------------

export type Channel = "SMS" | "WHATSAPP" | "PUSH" | "EMAIL" | "INAPP";
export type Topic = "ORDERS" | "PROMOS" | "ACCOUNT";

export interface SendDecisionInput {
  channel: Channel;
  topic: Topic;
  dltTemplateId?: string | null; // for SMS rows
  optedIn: boolean;              // user preference for this channel+topic
  nowIstHour: number;            // 0–23 IST
}

export type SendDecision =
  | { send: true }
  | { send: false; reason: "FAIL_CLOSED_NO_DLT" | "OPTED_OUT" | "QUIET_HOURS" };

/**
 * Decide whether to send (spec M22):
 *  - SMS with empty dlt_template_id → FAIL CLOSED (never sent).
 *  - ORDERS topic is always on (cannot opt out); PROMOS/ACCOUNT respect opt-in.
 *  - PROMOS suppressed during quiet hours 21:00–08:00 IST.
 */
export function decideSend(i: SendDecisionInput): SendDecision {
  if (i.channel === "SMS" && !i.dltTemplateId?.trim()) return { send: false, reason: "FAIL_CLOSED_NO_DLT" };
  if (i.topic !== "ORDERS" && !i.optedIn) return { send: false, reason: "OPTED_OUT" };
  if (i.topic === "PROMOS" && (i.nowIstHour >= 21 || i.nowIstHour < 8)) return { send: false, reason: "QUIET_HOURS" };
  return { send: true };
}

/** Critical order events fall back push→SMS→email: first available channel. */
export function fallbackChannel(available: Channel[]): Channel | null {
  for (const c of ["PUSH", "SMS", "EMAIL"] as Channel[]) if (available.includes(c)) return c;
  return available[0] ?? null;
}

/** Render a body template with {{var}} substitution. */
export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
}

// ---- M19 returns ----------------------------------------------------------

export type ReturnReason = "DAMAGED" | "WRONG_ITEM" | "NOT_AS_DESCRIBED" | "SIZE_ISSUE" | "CHANGED_MIND" | "LATE_DELIVERY" | "OTHER";

export interface ReturnEligibilityInput {
  deliveredAt: Date;
  now: Date;
  windowDays: number;         // per-category, 7 default
  isNonReturnable: boolean;
}
export type ReturnEligibility = { ok: true } | { ok: false; reason: "NON_RETURNABLE" | "WINDOW_EXPIRED" };

export function isWithinReturnWindow(i: ReturnEligibilityInput): ReturnEligibility {
  if (i.isNonReturnable) return { ok: false, reason: "NON_RETURNABLE" };
  const expires = i.deliveredAt.getTime() + i.windowDays * 24 * 60 * 60 * 1000;
  if (i.now.getTime() > expires) return { ok: false, reason: "WINDOW_EXPIRED" };
  return { ok: true };
}

export interface AutoApproveInput {
  reason: ReturnReason;
  itemValuePaise: number;
  userReturns: number;   // returns in last window
  userOrders: number;    // orders in last window
}

/**
 * Auto-approve ≤ ₹500 when reason ∈ {SIZE_ISSUE, CHANGED_MIND} and no abuse
 * history (>3 returns per 10 orders → manual). Else manual review.
 */
export function shouldAutoApprove(i: AutoApproveInput): boolean {
  if (i.itemValuePaise > 50000) return false; // > ₹500
  if (!(i.reason === "SIZE_ISSUE" || i.reason === "CHANGED_MIND")) return false;
  const rate = i.userOrders > 0 ? i.userReturns / i.userOrders : 0;
  if (rate > 3 / 10) return false; // abuse gate
  return true;
}

// ---- M23 support SLA ------------------------------------------------------

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const SLA_HOURS: Record<Priority, number> = { URGENT: 2, HIGH: 8, MEDIUM: 24, LOW: 48 };

export function slaDueAt(priority: Priority, from: Date): Date {
  return new Date(from.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000);
}

/** An open dispute (RETURN_DISPUTE / REFUND_ESCALATION, not resolved) freezes refunds. */
export function freezesRefund(type: string, status: string): boolean {
  const disputeTypes = ["RETURN_DISPUTE", "REFUND_ESCALATION"];
  const openStates = ["OPEN", "IN_PROGRESS", "AWAITING_CUSTOMER", "ESCALATED"];
  return disputeTypes.includes(type) && openStates.includes(status);
}

export function ticketNo(seq: number, year = new Date().getUTCFullYear()): string {
  return `TKT-${year}-${String(seq).padStart(6, "0")}`;
}
