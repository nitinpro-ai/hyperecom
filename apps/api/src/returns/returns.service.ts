import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { isWithinReturnWindow, shouldAutoApprove, type ReturnReason } from "../support/step14.core";

export interface RequestReturnInput {
  sellerOrderId: string;
  orderItemId: string;
  userId: string;
  reason: ReturnReason;
  comments?: string;
  mediaIds?: string[];
}

export type RequestReturnResult =
  | { ok: true; returnId: string; status: "APPROVED" | "REQUESTED" }
  | { ok: false; reason: "NOT_DELIVERED" | "WINDOW_EXPIRED" | "NON_RETURNABLE" | "ITEM_NOT_FOUND" };

const DEFAULT_WINDOW_DAYS = 7;

/**
 * M19 — Returns. request → window check → auto-approve gate → (approved emits
 * return.approved.v1 for M17 reverse pickup + M16 refund). Inspection pass →
 * refund + restock(RETURN movement); fail → dispute (M23), refund frozen.
 */
@Injectable()
export class ReturnsService {
  async request(input: RequestReturnInput): Promise<RequestReturnResult> {
    const so = await prisma.sellerOrder.findUnique({ where: { id: input.sellerOrderId } });
    if (!so || so.status !== "DELIVERED") return { ok: false, reason: "NOT_DELIVERED" };
    const item = await prisma.orderItem.findUnique({ where: { id: input.orderItemId } });
    if (!item) return { ok: false, reason: "ITEM_NOT_FOUND" };

    // window check (per-category window via product→category; default 7d)
    const windowDays = await this.windowDaysFor(item.productId);
    const elig = isWithinReturnWindow({
      deliveredAt: so.deliveredAt ?? new Date(), now: new Date(),
      windowDays, isNonReturnable: windowDays <= 0,
    });
    if (!elig.ok) return { ok: false, reason: elig.reason };

    // abuse history (last 10 orders / returns)
    const userOrders = await prisma.order.count({ where: { userId: input.userId } });
    const userReturns = await prisma.returnRequest.count({ where: { userId: input.userId } });
    const auto = shouldAutoApprove({ reason: input.reason, itemValuePaise: Number(item.lineTotalPaise), userReturns, userOrders });

    const rr = await prisma.$transaction(async (tx) => {
      const r = await tx.returnRequest.create({
        data: {
          sellerOrderId: input.sellerOrderId, orderItemId: input.orderItemId, userId: input.userId,
          reason: input.reason, comments: input.comments ?? null, mediaIds: input.mediaIds ?? [],
          status: auto ? "APPROVED" : "REQUESTED",
          requestedAt: new Date(), windowExpiresAt: new Date(Date.now() + windowDays * 86400e3),
        },
      });
      if (auto) {
        await tx.outboxEvent.create({ data: { aggregateType: "return", aggregateId: r.id, eventType: "return.approved.v1", payload: { returnId: r.id, sellerOrderId: input.sellerOrderId, orderItemId: input.orderItemId } } });
      }
      return r;
    });
    return { ok: true, returnId: rr.id, status: auto ? "APPROVED" : "REQUESTED" };
  }

  /** Seller/admin inspection. pass → refund + restock(RETURN); fail → dispute ticket + freeze. */
  async inspect(returnId: string, pass: boolean, note?: string): Promise<{ ok: boolean; outcome?: string }> {
    const rr = await prisma.returnRequest.findUnique({ where: { id: returnId } });
    if (!rr) return { ok: false };

    if (pass) {
      await prisma.$transaction(async (tx) => {
        await tx.returnRequest.update({ where: { id: returnId }, data: { status: "INSPECTION_PASSED", resolutionNote: note ?? null } });
        // restock: RETURN movement + on_hand += qty
        const item = await tx.orderItem.findUnique({ where: { id: rr.orderItemId } });
        if (item?.listingVariantId) {
          const stock = await tx.stock.findFirst({ where: { listingVariantId: item.listingVariantId }, select: { id: true } });
          if (stock) {
            await tx.$executeRaw`UPDATE stock SET quantity_on_hand = quantity_on_hand + ${item.quantity} WHERE id = ${stock.id}::uuid`;
            await tx.stockMovement.create({ data: { stockId: stock.id, deltaOnHand: item.quantity, deltaReserved: 0, reason: "RETURN", referenceType: "return", referenceId: returnId } });
          }
        }
        // refund (item-scoped) via M15
        const payment = await tx.payment.findFirst({ where: { order: { sellerOrders: { some: { id: rr.sellerOrderId } } } } });
        if (payment && item) {
          const refund = await tx.refund.create({ data: { paymentId: payment.id, sellerOrderId: rr.sellerOrderId, orderItemId: rr.orderItemId, amountPaise: item.lineTotalPaise, reason: "return inspection passed", status: "REQUESTED" } });
          await tx.returnRequest.update({ where: { id: returnId }, data: { status: "REFUND_INITIATED", refundId: refund.id } });
        }
      });
      return { ok: true, outcome: "REFUND_INITIATED" };
    }

    // inspection failed → open a dispute ticket; refund frozen until admin resolves
    await prisma.$transaction(async (tx) => {
      await tx.returnRequest.update({ where: { id: returnId }, data: { status: "INSPECTION_FAILED", resolutionNote: note ?? null } });
      const seq = await nextSeq(tx, "ticket_seq");
      await tx.supportTicket.create({
        data: {
          ticketNo: `TKT-${new Date().getUTCFullYear()}-${String(seq).padStart(6, "0")}`,
          openedByUserId: rr.userId, type: "RETURN_DISPUTE", sellerOrderId: rr.sellerOrderId,
          subject: "Return inspection failed — dispute", priority: "HIGH", status: "OPEN",
          slaDueAt: new Date(Date.now() + 8 * 3600e3),
        },
      });
    });
    return { ok: true, outcome: "DISPUTE_OPENED" };
  }

  private async windowDaysFor(productId: string | null): Promise<number> {
    if (!productId) return DEFAULT_WINDOW_DAYS;
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { category: { select: { returnWindowDays: true, isNonReturnable: true } } } });
    if (product?.category.isNonReturnable) return 0;
    return product?.category.returnWindowDays ?? DEFAULT_WINDOW_DAYS;
  }
}

async function nextSeq(tx: any, key: string): Promise<number> {
  const k = `${key}_${new Date().getUTCFullYear()}`;
  const row = await tx.systemCheck.upsert({ where: { key: k }, update: {}, create: { key: k, value: "0" } });
  const next = Number.parseInt(row.value ?? "0", 10) + 1;
  await tx.systemCheck.update({ where: { key: k }, data: { value: String(next) } });
  return next;
}
