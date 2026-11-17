import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { withinEditWindow, recomputeAverage, needsModeration } from "./reviews.core";

export interface SubmitReviewInput {
  userId: string;
  orderItemId: string;
  rating: number;
  title?: string;
  body?: string;
  mediaIds?: string[];
}

export type SubmitResult =
  | { ok: true; reviewId: string; status: string }
  | { ok: false; reason: "NOT_VERIFIED_PURCHASE" | "ALREADY_REVIEWED" | "NOT_DELIVERED" };

/**
 * M21 — Reviews. Verified-purchase only (item on a DELIVERED order owned by the
 * user), one per order_item, 7-day edit window, moderation queue. On approve the
 * product/shop rating aggregates are recomputed EXACTLY (mean of all approved).
 */
@Injectable()
export class ReviewsService {
  async submit(input: SubmitReviewInput): Promise<SubmitResult> {
    const item = await prisma.orderItem.findUnique({
      where: { id: input.orderItemId },
      select: { id: true, orderId: true, sellerOrderId: true, productId: true,
        order: { select: { userId: true } },
        sellerOrder: { select: { status: true, shopId: true } } },
    });
    if (!item) return { ok: false, reason: "NOT_VERIFIED_PURCHASE" };
    if (item.order.userId !== input.userId) return { ok: false, reason: "NOT_VERIFIED_PURCHASE" };
    if (item.sellerOrder.status !== "DELIVERED") return { ok: false, reason: "NOT_DELIVERED" };

    const existing = await prisma.review.findUnique({ where: { orderItemId: input.orderItemId } });
    if (existing) return { ok: false, reason: "ALREADY_REVIEWED" };

    const status = needsModeration(input.body) || needsModeration(input.title) ? "PENDING" : "APPROVED";
    const review = await prisma.review.create({
      data: {
        userId: input.userId, sellerOrderId: item.sellerOrderId, orderItemId: input.orderItemId,
        productId: item.productId!, shopId: item.sellerOrder.shopId,
        rating: input.rating, title: input.title ?? null, body: input.body ?? null,
        mediaIds: input.mediaIds ?? [], status,
      },
    });
    if (status === "APPROVED") await this.recompute(item.productId!, item.sellerOrder.shopId);
    return { ok: true, reviewId: review.id, status };
  }

  async edit(reviewId: string, userId: string, changes: { rating?: number; title?: string; body?: string }): Promise<{ ok: boolean; reason?: string }> {
    const r = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!r || r.userId !== userId) return { ok: false, reason: "NOT_FOUND" };
    if (!withinEditWindow(r.createdAt)) return { ok: false, reason: "EDIT_WINDOW_CLOSED" };
    await prisma.review.update({ where: { id: reviewId }, data: { ...changes } });
    if (changes.rating != null && r.status === "APPROVED") await this.recompute(r.productId, r.shopId);
    return { ok: true };
  }

  /** Admin moderation: approve/reject → exact aggregate recompute. */
  async moderate(reviewId: string, decision: "APPROVED" | "REJECTED", reason?: string): Promise<{ ok: boolean }> {
    const r = await prisma.review.findUnique({ where: { id: reviewId } });
    if (!r) return { ok: false };
    await prisma.review.update({ where: { id: reviewId }, data: { status: decision, moderationReason: reason ?? null } });
    await this.recompute(r.productId, r.shopId);
    return { ok: true };
  }

  async forProduct(productId: string) {
    return prisma.review.findMany({ where: { productId, status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 50 });
  }

  /** Exact recompute: mean of all APPROVED ratings for the product + the shop. */
  private async recompute(productId: string, shopId: string): Promise<void> {
    const [prodRatings, shopRatings] = await Promise.all([
      prisma.review.findMany({ where: { productId, status: "APPROVED" }, select: { rating: true } }),
      prisma.review.findMany({ where: { shopId, status: "APPROVED" }, select: { rating: true } }),
    ]);
    const p = recomputeAverage(prodRatings.map((x) => x.rating));
    const s = recomputeAverage(shopRatings.map((x) => x.rating));
    await prisma.$transaction([
      prisma.product.update({ where: { id: productId }, data: { ratingAvg: p.avg, ratingCount: p.count } }),
      prisma.shop.update({ where: { id: shopId }, data: { ratingAvg: s.avg, ratingCount: s.count } }),
    ]);
  }
}
