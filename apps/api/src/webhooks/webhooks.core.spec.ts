import { describe, expect, it } from "vitest";
import { nextRetry, signPayload, matches, MAX_ATTEMPTS } from "./webhooks.core";

describe("webhooks.core — retry schedule", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  it("advances through the backoff then DEAD", () => {
    // attempt 1 fails → PENDING, next in 5m (BACKOFF_MS[1])
    const r1 = nextRetry(1, now);
    expect(r1.status).toBe("PENDING");
    expect(r1.attempts).toBe(2);
    // after the 5th attempt fails → DEAD
    const dead = nextRetry(MAX_ATTEMPTS - 1, now);
    expect(dead.status).toBe("DEAD");
    expect(dead.nextAttemptAt).toBeNull();
  });
});

describe("webhooks.core — signing + matching", () => {
  it("signs deterministically", () => {
    const a = signPayload('{"x":1}', "secret");
    expect(a).toBe(signPayload('{"x":1}', "secret"));
    expect(a).not.toBe(signPayload('{"x":1}', "other"));
  });
  it("matches active subscriptions to event types (+ wildcard)", () => {
    expect(matches({ isActive: true, eventTypes: ["order.placed.v1"] }, "order.placed.v1")).toBe(true);
    expect(matches({ isActive: true, eventTypes: ["*"] }, "anything.v1")).toBe(true);
    expect(matches({ isActive: false, eventTypes: ["*"] }, "x")).toBe(false);
    expect(matches({ isActive: true, eventTypes: ["a.v1"] }, "b.v1")).toBe(false);
  });
});
