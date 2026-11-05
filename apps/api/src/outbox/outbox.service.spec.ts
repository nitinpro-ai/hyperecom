import { describe, expect, it, vi } from "vitest";
import { OutboxService } from "./outbox.service";

/** M27 acceptance tests (spec: guide PART II / spec/12 — atomic, idempotent, retried). */
describe("OutboxService", () => {
  const fakeTx = { outboxEvent: { create: vi.fn().mockResolvedValue({}) } } as never;

  it("publish writes the event inside the caller's transaction", async () => {
    const svc = new OutboxService();
    await svc.publish(fakeTx as never, {
      aggregateType: "order", aggregateId: "0e5d1b4a-…", eventType: "order.placed.v1", payload: { orderId: "x" },
    });
    expect(fakeTx.outboxEvent.create).toHaveBeenCalledOnce();
  });

  it("delivers to registered handlers and is idempotent on re-dispatch", async () => {
    const svc = new OutboxService();
    const handler = vi.fn().mockResolvedValue(undefined);
    svc.on("order.placed.v1", handler);
    await svc.deliver("e1", "order.placed.v1", { a: 1 });
    await svc.deliver("e1", "order.placed.v1", { a: 1 }); // duplicate ignored
    expect(handler).toHaveBeenCalledOnce();
  });
});
