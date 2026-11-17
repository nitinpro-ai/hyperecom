import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { nextRetry, signPayload, matches } from "./webhooks.core";

export interface SubscribeInput {
  ownerType: "SELLER" | "SYSTEM";
  ownerId?: string;
  url: string;
  secret: string;
  eventTypes: string[];
}

/**
 * M28 — Outbound webhooks. Subscriptions fan-out on matching events; each
 * delivery is HMAC-signed and retried 1m/5m/30m/2h/6h → DEAD. Management API +
 * a processPending sweep (wired to a CronJob in ops).
 */
@Injectable()
export class WebhooksService {
  async subscribe(input: SubscribeInput): Promise<{ subscriptionId: string }> {
    const s = await prisma.webhookSubscription.create({
      data: { ownerType: input.ownerType, ownerId: input.ownerId ?? null, url: input.url, secret: input.secret, eventTypes: input.eventTypes },
    });
    return { subscriptionId: s.id };
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    await prisma.webhookSubscription.update({ where: { id: subscriptionId }, data: { isActive: false } });
  }

  async list(ownerType: string, ownerId?: string) {
    return prisma.webhookSubscription.findMany({
      where: { ownerType, ...(ownerId ? { ownerId } : {}), isActive: true },
      select: { id: true, url: true, eventTypes: true, isActive: true },
    });
  }

  /** Fan-out an event to all matching active subscriptions → enqueue deliveries. */
  async dispatch(eventType: string, payload: Record<string, unknown>): Promise<{ enqueued: number }> {
    const subs = await prisma.webhookSubscription.findMany({ where: { isActive: true } });
    const targets = subs.filter((s) => matches(s, eventType));
    for (const s of targets) {
      await prisma.webhookDelivery.create({
        data: { subscriptionId: s.id, eventType, payload: payload as object, status: "PENDING" },
      });
    }
    return { enqueued: targets.length };
  }

  /**
   * Attempt one delivery: POST the signed payload; on success → DELIVERED,
   * on failure → advance the retry schedule (or DEAD). `fetchImpl` injectable for tests.
   */
  async attemptDelivery(
    deliveryId: string,
    fetchImpl: (url: string, init: { headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }> = defaultFetch,
  ): Promise<{ status: string }> {
    const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { subscription: true } });
    if (!delivery || delivery.status === "DELIVERED" || delivery.status === "DEAD") return { status: delivery?.status ?? "NOT_FOUND" };

    const body = JSON.stringify({ event: delivery.eventType, data: delivery.payload });
    const signature = signPayload(body, delivery.subscription.secret);
    let ok = false, code = 0, err: string | null = null;
    try {
      const res = await fetchImpl(delivery.subscription.url, {
        headers: { "Content-Type": "application/json", "X-ApnaCity-Signature": signature, "X-ApnaCity-Event": delivery.eventType },
        body,
      });
      ok = res.ok; code = res.status;
    } catch (e) {
      err = (e as Error).message;
    }

    if (ok) {
      await prisma.webhookDelivery.update({ where: { id: deliveryId }, data: { status: "DELIVERED", attempts: delivery.attempts + 1, lastStatusCode: code, deliveredAt: new Date() } });
      return { status: "DELIVERED" };
    }
    const retry = nextRetry(delivery.attempts);
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: retry.status, attempts: retry.attempts, nextAttemptAt: retry.nextAttemptAt ?? delivery.nextAttemptAt, lastStatusCode: code || null, lastError: err },
    });
    return { status: retry.status };
  }

  /** Sweep: attempt all PENDING deliveries whose nextAttemptAt has passed. */
  async processPending(now = new Date(), fetchImpl?: Parameters<WebhooksService["attemptDelivery"]>[1]): Promise<number> {
    const due = await prisma.webhookDelivery.findMany({
      where: { status: "PENDING", nextAttemptAt: { lte: now } },
      select: { id: true }, take: 100,
    });
    let n = 0;
    for (const d of due) { await this.attemptDelivery(d.id, fetchImpl); n++; }
    return n;
  }
}

async function defaultFetch(url: string, init: { headers: Record<string, string>; body: string }) {
  const res = await fetch(url, { method: "POST", headers: init.headers, body: init.body });
  return { ok: res.ok, status: res.status };
}
