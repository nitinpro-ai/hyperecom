import { describe, expect, it, vi, beforeEach } from "vitest";

/** In-memory feature_flags store + a controllable "DB down" switch. */
const store = new Map<string, any>();
let dbDown = false;
vi.mock("@apnacity/db", () => ({
  prisma: {
    featureFlag: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (dbDown) throw new Error("ECONNREFUSED");
        return store.get(where.key) ?? null;
      }),
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const row = { ...(store.get(where.key) ?? create), ...update };
        store.set(where.key, { key: where.key, ...row });
        return store.get(where.key);
      }),
    },
  },
}));

import {
  FeatureFlagsService,
  evaluateFlag,
  bucketOf,
  type FlagDefinition,
} from "./feature-flags.service";

/** Test subclass exposing a controllable clock (for the 30 s cache). */
class TestFlags extends FeatureFlagsService {
  public clock = 0;
  protected now(): number {
    return this.clock;
  }
}

beforeEach(() => {
  store.clear();
  dbDown = false;
});

/** ---- PURE CORE (no DB) — rule precedence / context / percentage ---- */
describe("evaluateFlag (pure core)", () => {
  const base = (over: Partial<FlagDefinition> = {}): FlagDefinition => ({
    key: "f",
    defaultEnabled: false,
    rules: [],
    ...over,
  });

  it("returns default_enabled when no rules match", () => {
    expect(evaluateFlag(base({ defaultEnabled: true }), {})).toBe(true);
    expect(evaluateFlag(base({ defaultEnabled: false }), {})).toBe(false);
  });

  it("first matching rule wins over default", () => {
    const def = base({
      defaultEnabled: false,
      rules: [{ when: { cityId: "bijnor" }, enabled: true }],
    });
    expect(evaluateFlag(def, { cityId: "bijnor" })).toBe(true);
    expect(evaluateFlag(def, { cityId: "delhi" })).toBe(false); // falls to default
  });

  it("matches on user and shop context", () => {
    const def = base({
      rules: [
        { when: { userId: "u1" }, enabled: true },
        { when: { shopId: "s9" }, enabled: true },
      ],
    });
    expect(evaluateFlag(def, { userId: "u1" })).toBe(true);
    expect(evaluateFlag(def, { shopId: "s9" })).toBe(true);
    expect(evaluateFlag(def, { userId: "other" })).toBe(false);
  });

  it("earlier rule takes precedence over a later contradictory rule", () => {
    const def = base({
      rules: [
        { when: { cityId: "bijnor" }, enabled: false }, // kill switch first
        { when: {}, enabled: true },
      ],
    });
    expect(evaluateFlag(def, { cityId: "bijnor" })).toBe(false);
  });

  it("percentage rollout is deterministic and bounded by the bucket", () => {
    // bucket is computed from the FLAG's own key ("f" via base()), not an arbitrary one
    const b = bucketOf("f", "user-123");
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(100);
    // same input → same bucket (stable rollout)
    expect(bucketOf("f", "user-123")).toBe(b);
    const def = base({ rules: [{ when: { percentage: b + 1 }, enabled: true }] });
    expect(evaluateFlag(def, { userId: "user-123" })).toBe(true); // bucket < pct
    const def2 = base({ rules: [{ when: { percentage: b }, enabled: true }] });
    expect(evaluateFlag(def2, { userId: "user-123" })).toBe(false); // bucket >= pct
  });

  it("anonymous user is never inside a partial percentage rollout", () => {
    const def = base({ rules: [{ when: { percentage: 99 }, enabled: true }] });
    expect(evaluateFlag(def, {})).toBe(false);
  });
});

/** ---- SERVICE — cache, ≤30 s flip, safe fallback ---- */
describe("FeatureFlagsService", () => {
  it("eval reads default_enabled from the DB", async () => {
    store.set("checkout_v2", { key: "checkout_v2", defaultEnabled: true, rules: [] });
    const svc = new TestFlags();
    expect(await svc.eval(["checkout_v2"], {})).toEqual({ checkout_v2: true });
  });

  it("unknown flag evaluates to off", async () => {
    const svc = new TestFlags();
    expect(await svc.eval(["does_not_exist"], {})).toEqual({ does_not_exist: false });
  });

  it("caches within 30 s, then a flip becomes visible after TTL", async () => {
    store.set("f", { key: "f", defaultEnabled: false, rules: [] });
    const svc = new TestFlags();
    svc.clock = 0;
    expect((await svc.eval(["f"], {})).f).toBe(false);

    // flip in DB directly (simulating another instance's write)
    store.set("f", { key: "f", defaultEnabled: true, rules: [] });

    svc.clock = 29_000; // within TTL → still cached (old value)
    expect((await svc.eval(["f"], {})).f).toBe(false);

    svc.clock = 30_001; // past TTL → refreshed
    expect((await svc.eval(["f"], {})).f).toBe(true);
  });

  it("set() invalidates the cache immediately", async () => {
    store.set("f", { key: "f", defaultEnabled: false, rules: [] });
    const svc = new TestFlags();
    expect((await svc.eval(["f"], {})).f).toBe(false);
    await svc.set({ key: "f", defaultEnabled: true });
    expect((await svc.eval(["f"], {})).f).toBe(true); // no 30 s wait
  });

  it("DB unreachable → serves last cached value", async () => {
    store.set("f", { key: "f", defaultEnabled: true, rules: [] });
    const svc = new TestFlags();
    expect((await svc.eval(["f"], {})).f).toBe(true); // warms cache
    dbDown = true;
    svc.clock = 31_000; // force cache expiry so it must hit the DB
    expect((await svc.eval(["f"], {})).f).toBe(true); // stale cache fallback
  });

  it("DB unreachable with no cache → safe default (off)", async () => {
    dbDown = true;
    const svc = new TestFlags();
    expect((await svc.eval(["f"], {})).f).toBe(false);
  });
});
