import { createHmac } from "node:crypto";

/**
 * M28 webhooks — pure core: retry backoff schedule + HMAC signing. No DB.
 * Spec: retries 1m/5m/30m/2h/6h, then DEAD.
 */

/** Backoff delays in ms per attempt number (1-indexed). */
const BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000, 6 * 3600_000];
export const MAX_ATTEMPTS = BACKOFF_MS.length; // 5 → after the 5th failure → DEAD

export interface RetryDecision {
  status: "PENDING" | "DEAD";
  attempts: number;
  nextAttemptAt: Date | null; // null when DEAD
}

/** Given the current attempt count after a FAILED delivery, decide next state. */
export function nextRetry(attemptsSoFar: number, now = new Date()): RetryDecision {
  const attempts = attemptsSoFar + 1;
  if (attempts >= MAX_ATTEMPTS) return { status: "DEAD", attempts, nextAttemptAt: null };
  const delay = BACKOFF_MS[attempts] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!;
  return { status: "PENDING", attempts, nextAttemptAt: new Date(now.getTime() + delay) };
}

/** HMAC-SHA256 signature of the raw body with the subscription secret. */
export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

/** A subscription receives an event iff it's active and subscribed to the type. */
export function matches(sub: { isActive: boolean; eventTypes: string[] }, eventType: string): boolean {
  return sub.isActive && (sub.eventTypes.includes(eventType) || sub.eventTypes.includes("*"));
}
