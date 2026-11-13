import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";

/** Context a flag is evaluated against (all optional; auth-optional endpoint). */
export interface FlagContext {
  userId?: string;
  cityId?: string;
  shopId?: string;
}

/** One override rule. `when` must fully match the context to apply `enabled`. */
export interface FlagRule {
  when?: { userId?: string; cityId?: string; shopId?: string; percentage?: number };
  enabled: boolean;
}

export interface FlagDefinition {
  key: string;
  defaultEnabled: boolean;
  rules: FlagRule[];
}

const CACHE_TTL_MS = 30_000; // 30 s (spec M29)

/**
 * Deterministic 0–99 bucket for percentage rollout: stable per (key,userId).
 * No user → bucket 0 so percentage rules only ever apply to identified users.
 */
export function bucketOf(key: string, userId?: string): number {
  if (!userId) return 100; // never inside any percentage < 100 → treated as "not in rollout"
  let h = 0;
  for (const ch of `${key}:${userId}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100;
}

/**
 * PURE evaluation core — no DB, fully unit-testable. First matching rule wins;
 * otherwise defaultEnabled.
 */
export function evaluateFlag(def: FlagDefinition, ctx: FlagContext): boolean {
  for (const rule of def.rules ?? []) {
    const w = rule.when ?? {};
    if (w.userId && w.userId !== ctx.userId) continue;
    if (w.cityId && w.cityId !== ctx.cityId) continue;
    if (w.shopId && w.shopId !== ctx.shopId) continue;
    if (w.percentage != null && bucketOf(def.key, ctx.userId) >= w.percentage) continue;
    return rule.enabled;
  }
  return def.defaultEnabled;
}

@Injectable()
export class FeatureFlagsService {
  private cache = new Map<string, { def: FlagDefinition; at: number }>();

  /** Testing seam: override the clock. */
  protected now(): number {
    return Date.now();
  }

  private toDef(row: {
    key: string;
    defaultEnabled: boolean;
    rules: unknown;
  }): FlagDefinition {
    return {
      key: row.key,
      defaultEnabled: row.defaultEnabled,
      rules: Array.isArray(row.rules) ? (row.rules as FlagRule[]) : [],
    };
  }

  /** Load a flag definition with a 30 s cache + safe fallback on DB error. */
  private async load(key: string): Promise<FlagDefinition> {
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < CACHE_TTL_MS) return hit.def;

    try {
      const row = await prisma.featureFlag.findUnique({ where: { key } });
      const def: FlagDefinition = row
        ? this.toDef(row)
        : { key, defaultEnabled: false, rules: [] }; // unknown flag = off
      this.cache.set(key, { def, at: this.now() });
      return def;
    } catch {
      // DB unreachable → serve stale cache if any, else safe default (off).
      if (hit) return hit.def;
      return { key, defaultEnabled: false, rules: [] };
    }
  }

  /** eval(keys, context) → { key: boolean }. */
  async eval(keys: string[], ctx: FlagContext): Promise<Record<string, boolean>> {
    const out: Record<string, boolean> = {};
    for (const key of keys) {
      const def = await this.load(key);
      out[key] = evaluateFlag(def, ctx);
    }
    return out;
  }

  /** Admin CRUD upsert (full admin RBAC lands with M24). */
  async set(def: {
    key: string;
    description?: string;
    defaultEnabled: boolean;
    rules?: FlagRule[];
    updatedBy?: string;
  }): Promise<void> {
    await prisma.featureFlag.upsert({
      where: { key: def.key },
      update: {
        description: def.description ?? null,
        defaultEnabled: def.defaultEnabled,
        rules: (def.rules ?? []) as unknown as object,
        updatedBy: def.updatedBy ?? null,
      },
      create: {
        key: def.key,
        description: def.description ?? null,
        defaultEnabled: def.defaultEnabled,
        rules: (def.rules ?? []) as unknown as object,
        updatedBy: def.updatedBy ?? null,
      },
    });
    this.cache.delete(def.key); // invalidate immediately on write
  }
}
