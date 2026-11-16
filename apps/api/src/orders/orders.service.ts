import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { childTransition, deriveParentStatus, type Actor, type ChildAction, type ChildStatus } from "./orders.core";

export type TransitionResponse =
  | { ok: true; status: ChildStatus; parentStatus: string }
  | { ok: false; code: 404 | 409; reason: string };

/**
 * M14 — OMS. Applies validated seller/child transitions (role × from→to else
 * 409), writes one order_events row per transition, releases/consumes stock and
 * triggers refunds per the state machine — all in ONE transaction. Re-derives
 * the parent order status from its children.
 */
@Injectable()
export class OrdersService {
  async transition(sellerOrderId: string, action: ChildAction, actor: Actor, actorId?: string, reason?: string): Promise<TransitionResponse> {
    return prisma.$transaction(async (tx) => {
      const so = await tx.sellerOrder.findUnique({ where: { id: sellerOrderId } });
      if (!so) return { ok: false as const, code: 404 as const, reason: "seller order not found" };

      const t = childTransition(so.status as ChildStatus, action, actor);
      if (!t.ok) return { ok: false as const, code: 409 as const, reason: t.reason };

      await tx.sellerOrder.update({
        where: { id: sellerOrderId },
        data: {
          status: t.to,
          ...(t.to === "ACCEPTED" ? { acceptedAt: new Date() } : {}),
          ...(t.to === "REJECTED" ? { rejectedReason: reason ?? (action === "TIMEOUT" ? "accept timeout" : "rejected") } : {}),
          ...(t.to === "DELIVERED" ? { deliveredAt: new Date() } : {}),
          ...(t.to === "CLOSED" ? { closedAt: new Date() } : {}),
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: so.orderId, sellerOrderId, event: `CHILD_${action}`,
          fromStatus: so.status, toStatus: t.to, actorType: actor, actorId: actorId ?? null,
          payload: reason ? { reason } : undefined,
        },
      });

      // stock release (reject/cancel) or consume (dispatch) — via the items' reservations
      if (t.releasesStock || t.consumesStock) {
        const items = await tx.orderItem.findMany({ where: { sellerOrderId }, select: { listingVariantId: true, quantity: true } });
        for (const it of items) {
          if (!it.listingVariantId) continue;
          const stock = await tx.stock.findFirst({ where: { listingVariantId: it.listingVariantId }, select: { id: true } });
          if (!stock) continue;
          if (t.releasesStock) {
            await tx.$executeRaw`UPDATE stock SET quantity_reserved = quantity_reserved - ${it.quantity} WHERE id = ${stock.id}::uuid AND quantity_reserved >= ${it.quantity}`;
            await tx.stockMovement.create({ data: { stockId: stock.id, deltaOnHand: 0, deltaReserved: -it.quantity, reason: "ORDER_RELEASE", referenceType: "seller_order", referenceId: sellerOrderId } });
          } else if (t.consumesStock) {
            await tx.$executeRaw`UPDATE stock SET quantity_on_hand = quantity_on_hand - ${it.quantity}, quantity_reserved = quantity_reserved - ${it.quantity} WHERE id = ${stock.id}::uuid AND quantity_reserved >= ${it.quantity}`;
            await tx.stockMovement.create({ data: { stockId: stock.id, deltaOnHand: -it.quantity, deltaReserved: -it.quantity, reason: "ORDER_SALE", referenceType: "seller_order", referenceId: sellerOrderId } });
          }
        }
      }

      // refund trigger (pre-delivery termination) → refund row + event (M15 processes it)
      if (t.refunds) {
        const payment = await tx.payment.findFirst({ where: { orderId: so.orderId } });
        if (payment) {
          await tx.refund.create({ data: { paymentId: payment.id, sellerOrderId, amountPaise: so.itemsTotalPaise + so.deliveryFeePaise, reason: reason ?? "order terminated", status: "REQUESTED" } });
          await tx.outboxEvent.create({ data: { aggregateType: "seller_order", aggregateId: sellerOrderId, eventType: `order.child.${t.to.toLowerCase()}.v1`, payload: { sellerOrderId, orderId: so.orderId } } });
        }
      }

      // re-derive parent status
      const siblings = await tx.sellerOrder.findMany({ where: { orderId: so.orderId }, select: { status: true } });
      const parentStatus = deriveParentStatus(siblings.map((s) => s.status as ChildStatus));
      await tx.order.update({
        where: { id: so.orderId },
        data: {
          status: parentStatus,
          ...(parentStatus === "COMPLETED" ? { completedAt: new Date() } : {}),
          ...(parentStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}),
        },
      });

      return { ok: true as const, status: t.to, parentStatus };
    });
  }

  /** Customer cancels the whole order (only while all children NEW/ACCEPTED). */
  async cancelOrder(orderId: string, userId: string, reason: string): Promise<{ ok: boolean; code?: number; reason?: string }> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) return { ok: false, code: 404, reason: "order not found" };
    const children = await prisma.sellerOrder.findMany({ where: { orderId }, select: { id: true } });
    for (const c of children) {
      const r = await this.transition(c.id, "CANCEL", "CUSTOMER", userId, reason);
      if (!r.ok) return { ok: false, code: r.code, reason: r.reason };
    }
    return { ok: true };
  }

  /** Timer sweep: auto-reject NEW seller orders past their 10-min accept deadline. */
  async sweepTimeouts(now = new Date()): Promise<number> {
    const expired = await prisma.sellerOrder.findMany({
      where: { status: "NEW", acceptDeadlineAt: { lt: now } },
      select: { id: true },
    });
    let count = 0;
    for (const e of expired) {
      const r = await this.transition(e.id, "TIMEOUT", "SYSTEM");
      if (r.ok) count++;
    }
    return count;
  }
}
