import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";

export interface ReserveItem {
  stockId: string;
  orderItemId: string;
  quantity: number;
}

export type ReserveResult =
  | { ok: true; reservationIds: string[] }
  | { ok: false; reason: "INSUFFICIENT"; failedStockId: string };

const RESERVATION_TTL_MS = 30 * 60 * 1000; // 30 min (spec)

/**
 * M09 — Inventory. The SINGLE stock authority. The ONLY stock mutation is an
 * atomic conditional UPDATE (reserved += qty WHERE on_hand - reserved >= qty).
 * 0 rows affected ⇒ insufficient ⇒ reject. This is what prevents oversell under
 * concurrency — Redis is NEVER the authority. Every mutation writes a
 * stock_movements row in the SAME transaction.
 */
@Injectable()
export class InventoryService {
  /**
   * Reserve all items atomically. Each reserve is the conditional UPDATE; if any
   * item can't be satisfied the whole transaction rolls back (all-or-nothing).
   */
  async reserve(items: ReserveItem[]): Promise<ReserveResult> {
    try {
      const reservationIds = await prisma.$transaction(async (tx) => {
        const ids: string[] = [];
        for (const item of items) {
          // THE atomic conditional update — the oversell guard.
          const affected = await tx.$executeRaw`
            UPDATE stock
            SET quantity_reserved = quantity_reserved + ${item.quantity}
            WHERE id = ${item.stockId}::uuid
              AND (quantity_on_hand - quantity_reserved) >= ${item.quantity}`;
          if (affected === 0) {
            // insufficient — throw to roll back the whole reservation set
            throw new InsufficientStock(item.stockId);
          }
          const reservation = await tx.stockReservation.create({
            data: {
              stockId: item.stockId,
              orderItemId: item.orderItemId,
              quantity: item.quantity,
              status: "ACTIVE",
              expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
            },
          });
          await tx.stockMovement.create({
            data: {
              stockId: item.stockId,
              deltaOnHand: 0,
              deltaReserved: item.quantity,
              reason: "ORDER_RESERVE",
              referenceType: "order_item",
              referenceId: item.orderItemId,
            },
          });
          ids.push(reservation.id);
        }
        return ids;
      });
      return { ok: true, reservationIds };
    } catch (e) {
      if (e instanceof InsufficientStock) {
        return { ok: false, reason: "INSUFFICIENT", failedStockId: e.stockId };
      }
      throw e;
    }
  }

  /** Release ACTIVE reservations (cancel/reject/TTL) → frees reserved stock. */
  async release(reservationIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const id of reservationIds) {
        const r = await tx.stockReservation.findUnique({ where: { id } });
        if (!r || r.status !== "ACTIVE") continue;
        await tx.$executeRaw`
          UPDATE stock SET quantity_reserved = quantity_reserved - ${r.quantity}
          WHERE id = ${r.stockId}::uuid`;
        await tx.stockReservation.update({ where: { id }, data: { status: "RELEASED" } });
        await tx.stockMovement.create({
          data: {
            stockId: r.stockId, deltaOnHand: 0, deltaReserved: -r.quantity,
            reason: "ORDER_RELEASE", referenceType: "reservation", referenceId: id,
          },
        });
      }
    });
  }

  /** Consume on DISPATCH: on_hand -= qty, reserved -= qty (the sale is final). */
  async consume(reservationIds: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const id of reservationIds) {
        const r = await tx.stockReservation.findUnique({ where: { id } });
        if (!r || r.status !== "ACTIVE") continue;
        await tx.$executeRaw`
          UPDATE stock
          SET quantity_on_hand = quantity_on_hand - ${r.quantity},
              quantity_reserved = quantity_reserved - ${r.quantity}
          WHERE id = ${r.stockId}::uuid`;
        await tx.stockReservation.update({ where: { id }, data: { status: "CONSUMED" } });
        await tx.stockMovement.create({
          data: {
            stockId: r.stockId, deltaOnHand: -r.quantity, deltaReserved: -r.quantity,
            reason: "ORDER_SALE", referenceType: "reservation", referenceId: id,
          },
        });
      }
    });
  }

  /** Manual on-hand adjustment (seller edit, import, correction) + movement row. */
  async adjust(
    stockId: string,
    deltaOnHand: number,
    reason: "MANUAL_ADJUST" | "IMPORT" | "CORRECTION" | "RETURN",
    actorUserId?: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    try {
      await prisma.$transaction(async (tx) => {
        const affected = await tx.$executeRaw`
          UPDATE stock SET quantity_on_hand = quantity_on_hand + ${deltaOnHand}
          WHERE id = ${stockId}::uuid
            AND (quantity_on_hand + ${deltaOnHand}) >= quantity_reserved
            AND (quantity_on_hand + ${deltaOnHand}) >= 0`;
        if (affected === 0) throw new InsufficientStock(stockId);
        await tx.stockMovement.create({
          data: { stockId, deltaOnHand, deltaReserved: 0, reason, actorUserId: actorUserId ?? null },
        });
      });
      return { ok: true };
    } catch (e) {
      if (e instanceof InsufficientStock) return { ok: false, reason: "WOULD_GO_NEGATIVE" };
      throw e;
    }
  }

  /** Available = on_hand - reserved, per listing-variant. */
  async availability(listingVariantIds: string[]): Promise<Record<string, number>> {
    const rows = await prisma.stock.findMany({
      where: { listingVariantId: { in: listingVariantIds } },
      select: { listingVariantId: true, quantityOnHand: true, quantityReserved: true },
    });
    const out: Record<string, number> = {};
    for (const r of rows) {
      out[r.listingVariantId] = (out[r.listingVariantId] ?? 0) + (r.quantityOnHand - r.quantityReserved);
    }
    return out;
  }

  /** Reconciliation: stock vs sum(movements). Returns drift per stock row. */
  async reconcile(): Promise<Array<{ stockId: string; drift: number }>> {
    const rows = await prisma.$queryRaw<Array<{ stock_id: string; drift: number }>>`
      SELECT s.id AS stock_id,
             s.quantity_on_hand - COALESCE(SUM(m.delta_on_hand), 0) AS drift
      FROM stock s
      LEFT JOIN stock_movements m ON m.stock_id = s.id
      GROUP BY s.id, s.quantity_on_hand
      HAVING s.quantity_on_hand - COALESCE(SUM(m.delta_on_hand), 0) <> 0`;
    return rows.map((r) => ({ stockId: r.stock_id, drift: Number(r.drift) }));
  }
}

class InsufficientStock extends Error {
  constructor(public readonly stockId: string) {
    super(`insufficient stock: ${stockId}`);
  }
}
