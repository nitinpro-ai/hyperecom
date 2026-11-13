import { describe, expect, it, vi, beforeEach } from "vitest";

/** Mock the shared Prisma client so the service's idempotency_keys access is in-memory. */
const store = new Map<string, any>();
vi.mock("@apnacity/db", () => ({
  prisma: {
    idempotencyKey: {
      findUnique: vi.fn(async ({ where }: any) => store.get(where.key) ?? null),
      create: vi.fn(async ({ data }: any) => {
        if (store.has(data.key)) throw new Error("unique violation");
        store.set(data.key, { ...data });
        return data;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        store.set(where.key, { ...store.get(where.key), ...data });
        return store.get(where.key);
      }),
      delete: vi.fn(async ({ where }: any) => {
        store.delete(where.key);
        return {};
      }),
    },
  },
}));

import { IdempotencyService } from "./idempotency.service";

const USER = "11111111-1111-1111-1111-111111111111";

/** M30 acceptance (spec: replayed place-order returns the original, creates nothing new). */
describe("IdempotencyService", () => {
  beforeEach(() => store.clear());

  it("fresh key → caller proceeds, then stored response replays verbatim", async () => {
    const svc = new IdempotencyService();
    const key = "k-1";
    const hash = "hash-A";

    expect((await svc.lookup(key, USER, "POST /orders", hash)).kind).toBe("fresh");
    expect(await svc.reserve(key, USER, "POST /orders", hash)).toBe(true);
    await svc.persist(key, { status: 201, body: { orderId: "ORD-1" } });

    const replay = await svc.lookup(key, USER, "POST /orders", hash);
    expect(replay.kind).toBe("replay");
    if (replay.kind === "replay") {
      expect(replay.response.status).toBe(201);
      expect(replay.response.body).toEqual({ orderId: "ORD-1" });
    }
  });

  it("same key + different request hash → conflict (409)", async () => {
    const svc = new IdempotencyService();
    const key = "k-2";
    await svc.reserve(key, USER, "POST /orders", "hash-A");
    await svc.persist(key, { status: 201, body: { orderId: "ORD-2" } });

    const result = await svc.lookup(key, USER, "POST /orders", "hash-DIFFERENT");
    expect(result.kind).toBe("conflict");
  });

  it("reserve is single-winner under duplicate keys", async () => {
    const svc = new IdempotencyService();
    const key = "k-3";
    const first = await svc.reserve(key, USER, "POST /orders", "hash-A");
    const second = await svc.reserve(key, USER, "POST /orders", "hash-A");
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
