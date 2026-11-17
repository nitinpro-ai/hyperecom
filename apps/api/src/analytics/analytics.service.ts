import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { stripPii, rollupScopes, authorizeDashboard, type EventType, type Scope } from "./analytics.core";

export interface TrackInput {
  eventType: EventType;
  cityId?: string;
  shopId?: string;
  actorKey?: string; // pre-hashed/anonymised by the caller
  payload?: Record<string, unknown>;
  valuePaise?: number;
}

/**
 * M25 — Analytics. Append event stream (PII-stripped), daily rollups per
 * scope (platform/city/shop), tenant-scoped dashboard reads (seller = own shop).
 */
@Injectable()
export class AnalyticsService {
  async track(input: TrackInput): Promise<void> {
    await prisma.analyticsEvent.create({
      data: {
        eventType: input.eventType, cityId: input.cityId ?? null, shopId: input.shopId ?? null,
        actorKey: input.actorKey ?? null,
        payload: stripPii({ ...(input.payload ?? {}), ...(input.valuePaise != null ? { valuePaise: input.valuePaise } : {}) }) as object,
      },
    });
  }

  /**
   * Roll up a day's events into analytics_rollups (idempotent: recomputes the
   * day). Aggregates count + summed valuePaise per (scope, scopeId, eventType).
   */
  async runRollup(day: Date): Promise<{ rows: number }> {
    const start = new Date(day); start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start); end.setUTCDate(end.getUTCDate() + 1);

    const events = await prisma.analyticsEvent.findMany({
      where: { occurredAt: { gte: start, lt: end } },
      select: { eventType: true, cityId: true, shopId: true, payload: true },
    });

    // accumulate per (scope|scopeId|eventType)
    const acc = new Map<string, { scope: Scope; scopeId: string | null; eventType: string; count: number; value: number }>();
    for (const ev of events) {
      const value = Number((ev.payload as { valuePaise?: number } | null)?.valuePaise ?? 0);
      for (const [scope, scopeId] of rollupScopes(ev)) {
        const key = `${scope}|${scopeId ?? "-"}|${ev.eventType}`;
        const cur = acc.get(key) ?? { scope, scopeId, eventType: ev.eventType, count: 0, value: 0 };
        cur.count += 1; cur.value += value;
        acc.set(key, cur);
      }
    }

    const dayDate = new Date(start.toISOString().slice(0, 10));
    let rows = 0;
    await prisma.$transaction(async (tx) => {
      // clear the day's rollups first (idempotent recompute), then insert
      await tx.analyticsRollup.deleteMany({ where: { day: dayDate } });
      for (const r of acc.values()) {
        await tx.analyticsRollup.create({
          data: { day: dayDate, scope: r.scope, scopeId: r.scopeId, eventType: r.eventType, count: r.count, valuePaise: BigInt(r.value) },
        });
        rows++;
      }
    });
    return { rows };
  }

  /**
   * Tenant-scoped dashboard read. Enforces authorization (seller → own shop only).
   * Returns per-event-type counts + value for the scope over a day range.
   */
  async dashboard(
    role: string,
    requested: { scope: Scope; scopeId?: string | null },
    ctx: { cityId?: string; shopIds?: string[] },
    range: { from: Date; to: Date },
  ): Promise<{ ok: true; rows: Array<{ eventType: string; count: number; valuePaise: number }> } | { ok: false; reason: "FORBIDDEN" }> {
    const authed = authorizeDashboard(role, requested, ctx);
    if (!authed) return { ok: false, reason: "FORBIDDEN" };

    const rollups = await prisma.analyticsRollup.groupBy({
      by: ["eventType"],
      where: {
        scope: authed.scope,
        scopeId: authed.scopeId,
        day: { gte: new Date(range.from.toISOString().slice(0, 10)), lte: new Date(range.to.toISOString().slice(0, 10)) },
      },
      _sum: { count: true, valuePaise: true },
    });
    return {
      ok: true,
      rows: rollups.map((r) => ({ eventType: r.eventType, count: r._sum.count ?? 0, valuePaise: Number(r._sum.valuePaise ?? 0) })),
    };
  }
}
