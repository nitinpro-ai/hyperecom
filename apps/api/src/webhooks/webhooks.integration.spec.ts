import { describe, expect, it, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { WebhooksService } from "./webhooks.service";
import { signPayload } from "./webhooks.core";

/**
 * M28 integration (live DB): dispatch fans out to matching subs; successful
 * delivery → DELIVERED with a valid HMAC signature; repeated failure advances
 * the retry schedule and eventually marks DEAD. Uses an injected fetch (no network).
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG_URL = "https://example.test/zz-m28-hook";

d("M28 webhooks (integration)", () => {
  const hooks = new WebhooksService();

  afterAll(async () => {
    const subs = await prisma.webhookSubscription.findMany({ where: { url: { startsWith: TAG_URL } }, select: { id: true } });
    const ids = subs.map((s) => s.id);
    await prisma.webhookDelivery.deleteMany({ where: { subscriptionId: { in: ids } } });
    await prisma.webhookSubscription.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("dispatch enqueues deliveries only for matching active subscriptions", async () => {
    await hooks.subscribe({ ownerType: "SYSTEM", url: `${TAG_URL}/a`, secret: "s1", eventTypes: ["order.placed.v1"] });
    await hooks.subscribe({ ownerType: "SYSTEM", url: `${TAG_URL}/b`, secret: "s2", eventTypes: ["settlement.paid.v1"] });

    const r = await hooks.dispatch("order.placed.v1", { orderId: "o1" });
    expect(r.enqueued).toBe(1); // only sub A matches

    const deliveries = await prisma.webhookDelivery.findMany({ where: { eventType: "order.placed.v1", subscription: { url: { startsWith: TAG_URL } } } });
    expect(deliveries.length).toBe(1);
    expect(deliveries[0]!.status).toBe("PENDING");
  });

  it("successful delivery → DELIVERED with a verifiable signature", async () => {
    const { subscriptionId } = await hooks.subscribe({ ownerType: "SYSTEM", url: `${TAG_URL}/ok`, secret: "sig-secret", eventTypes: ["test.event.v1"] });
    await hooks.dispatch("test.event.v1", { hello: "world" });
    const del = await prisma.webhookDelivery.findFirstOrThrow({ where: { subscriptionId } });

    let capturedSig = "", capturedBody = "";
    const fakeFetch = async (_url: string, init: { headers: Record<string, string>; body: string }) => {
      capturedSig = init.headers["X-ApnaCity-Signature"]!; capturedBody = init.body;
      return { ok: true, status: 200 };
    };
    const res = await hooks.attemptDelivery(del.id, fakeFetch);
    expect(res.status).toBe("DELIVERED");
    // signature the receiver would verify matches body+secret
    expect(capturedSig).toBe(signPayload(capturedBody, "sig-secret"));
    const after = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: del.id } });
    expect(after.status).toBe("DELIVERED");
    expect(after.deliveredAt).not.toBeNull();
  });

  it("repeated failure advances retries then marks DEAD", async () => {
    const { subscriptionId } = await hooks.subscribe({ ownerType: "SYSTEM", url: `${TAG_URL}/fail`, secret: "x", eventTypes: ["fail.event.v1"] });
    await hooks.dispatch("fail.event.v1", {});
    const del = await prisma.webhookDelivery.findFirstOrThrow({ where: { subscriptionId } });

    const failFetch = async () => ({ ok: false, status: 500 });
    let status = "";
    for (let i = 0; i < 5; i++) {
      // force each attempt to be "due" by resetting nextAttemptAt to the past
      await prisma.webhookDelivery.update({ where: { id: del.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
      status = (await hooks.attemptDelivery(del.id, failFetch)).status;
    }
    expect(status).toBe("DEAD");
    const after = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: del.id } });
    expect(after.status).toBe("DEAD");
    expect(after.attempts).toBeGreaterThanOrEqual(5);
    expect(after.lastStatusCode).toBe(500);
  });
});
