import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import type { Prisma } from "@apnacity/db";
import { prisma } from "@apnacity/db";

export type EventHandler = (payload: unknown, event: { eventId: string; eventType: string }) => Promise<void>;
export type PublishTx = Prisma.TransactionClient;

const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 21_600_000]; // 1m 5m 30m 2h 6h

@Injectable()
export class OutboxService implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private readonly handlers = new Map<string, EventHandler[]>();
  private readonly processed = new Set<string>(); // consumer idempotency (Redis in Step 4)
  private timer?: NodeJS.Timeout;
  private running = false;

  /** Register a handler for an event type. Handlers must be idempotent. */
  on(eventType: string, handler: EventHandler): void {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
  }

  /**
   * Publish an event INSIDE the caller's DB transaction (never standalone).
   * Usage: prisma.$transaction(async (tx) => { await tx.order.create(...); await outbox.publish(tx, {...}); })
   */
  async publish(
    tx: PublishTx,
    event: { aggregateType: string; aggregateId: string; eventType: string; payload: unknown }
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
      },
    });
  }

  /** Start the dispatcher loop (called once at bootstrap; BullMQ worker replaces this in Step 4). */
  start(intervalMs = 1000): void {
    this.timer = setInterval(() => void this.dispatchBatch(), intervalMs);
  }

  /** Dispatch one batch of PENDING events. Exposed for tests. */
  async dispatchBatch(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let dispatched = 0;
    try {
      const batch = await prisma.outboxEvent.findMany({
        where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
        orderBy: { nextAttemptAt: "asc" },
        take: 20,
      });
      for (const ev of batch) {
        const ok = await this.deliver(ev.id, ev.eventType, ev.payload);
        await prisma.outboxEvent.update({
          where: { id: ev.id },
          data: ok
            ? { status: "DISPATCHED", dispatchedAt: new Date() }
            : {
                status: ev.attempts + 1 >= MAX_ATTEMPTS ? "DEAD" : "FAILED",
                attempts: { increment: 1 },
                nextAttemptAt: new Date(Date.now() + (BACKOFF_MS[ev.attempts] ?? BACKOFF_MS[4]!)),
              },
        });
        if (ok) dispatched++;
      }
      return dispatched;
    } finally {
      this.running = false;
    }
  }

  private async deliver(eventId: string, eventType: string, payload: unknown): Promise<boolean> {
    if (this.processed.has(eventId)) return true; // idempotent consumer
    try {
      for (const h of this.handlers.get(eventType) ?? []) {
        await h(payload, { eventId, eventType });
      }
      this.processed.add(eventId);
      return true;
    } catch (err) {
      this.logger.error(`dispatch failed for ${eventType} (${eventId}): ${String(err)}`);
      return false;
    }
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
