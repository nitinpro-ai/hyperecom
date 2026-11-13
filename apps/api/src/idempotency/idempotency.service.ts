import { Injectable } from "@nestjs/common";
import type { Prisma } from "@apnacity/db";
import { prisma } from "@apnacity/db";

export interface StoredResponse {
  status: number;
  body: unknown;
}

/** Outcome of reserving an idempotency key for an incoming request. */
export type IdempotencyLookup =
  | { kind: "replay"; response: StoredResponse } // same key + same request → return stored
  | { kind: "conflict" } // same key + DIFFERENT request → 409
  | { kind: "fresh" }; // first time (or expired) → caller proceeds, then persist

const TTL_MS = 24 * 60 * 60 * 1000; // 24 h (spec M30)

@Injectable()
export class IdempotencyService {
  /**
   * Reserve/lookup a key before the handler runs.
   *  - replay:   stored response exists for this key+hash → return it verbatim
   *  - conflict: key reused with a different request hash → 409
   *  - fresh:    no live record → caller runs the handler, then calls persist()
   * Expired records (expiresAt < now) are treated as absent and the key reusable.
   */
  async lookup(
    key: string,
    userId: string,
    endpoint: string,
    requestHash: string,
  ): Promise<IdempotencyLookup> {
    const existing = await prisma.idempotencyKey.findUnique({ where: { key } });

    if (!existing || existing.expiresAt.getTime() <= Date.now()) {
      if (existing) {
        // expired — clear so the key can be reused with a fresh request
        await prisma.idempotencyKey.delete({ where: { key } }).catch(() => undefined);
      }
      return { kind: "fresh" };
    }

    if (existing.requestHash !== requestHash || existing.userId !== userId) {
      return { kind: "conflict" };
    }

    if (existing.responseStatus == null) {
      // in-flight (handler not finished yet) — treat as replay-conflict-safe:
      // tell the caller it's a replay of an unfinished request → 409 is safest.
      return { kind: "conflict" };
    }

    return {
      kind: "replay",
      response: { status: existing.responseStatus, body: existing.responseBody },
    };
  }

  /** Reserve the key atomically as in-flight. Returns false if it already exists. */
  async reserve(
    key: string,
    userId: string,
    endpoint: string,
    requestHash: string,
  ): Promise<boolean> {
    try {
      await prisma.idempotencyKey.create({
        data: {
          key,
          userId,
          endpoint,
          requestHash,
          expiresAt: new Date(Date.now() + TTL_MS),
        },
      });
      return true;
    } catch {
      return false; // unique violation → another request reserved it first
    }
  }

  /** Persist the handler's response against a reserved key. */
  async persist(key: string, response: StoredResponse): Promise<void> {
    await prisma.idempotencyKey.update({
      where: { key },
      data: {
        responseStatus: response.status,
        responseBody: (response.body ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** Drop a reserved key when the handler failed (so the client can retry). */
  async release(key: string): Promise<void> {
    await prisma.idempotencyKey.delete({ where: { key } }).catch(() => undefined);
  }
}
