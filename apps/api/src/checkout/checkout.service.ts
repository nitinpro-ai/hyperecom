import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { computeQuote, orderNo, type QuoteLineInput } from "./checkout.core";

export interface PlaceOrderInput {
  userId: string;
  cityId: string;
  addressSnapshot: Record<string, unknown>;
  deliveryFeePaiseByShop?: Record<string, number>;
  discountPaise?: number;
}

export type PlaceResult =
  | { ok: true; orderId: string; orderNo: string; sellerOrderCount: number; grandTotalPaise: number }
  | { ok: false; reason: "EMPTY_CART" | "NO_CART" }
  | { ok: false; reason: "INSUFFICIENT_STOCK"; shortfalls: Array<{ listingVariantId: string; requested: number; available: number }> };

const DEFAULT_FEE = 4000; // ₹40/shop default until M03/M17 zone fees wire in

@Injectable()
export class CheckoutService {
  /** Quote: group the open cart by shop + totals. Pure math in checkout.core. */
  async quote(userId: string, deliveryFeePaiseByShop: Record<string, number> = {}, discountPaise = 0) {
    const cart = await prisma.cart.findFirst({ where: { userId, status: "OPEN" } });
    if (!cart) return null;
    const items = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    const lines = await this.toLines(items);
    const fees = this.fees(items.map((i) => i.shopId), deliveryFeePaiseByShop);
    return computeQuote(lines, fees, discountPaise);
  }

  /**
   * Place order — ONE transaction. Writes parent order + seller_orders +
   * order_items (snapshots) + atomic stock reservations + order_events(PLACED) +
   * outbox order.placed.v1 + payment row. Insufficient stock → 422, NOTHING written.
   */
  async placeOrder(input: PlaceOrderInput): Promise<PlaceResult> {
    const cart = await prisma.cart.findFirst({ where: { userId: input.userId, status: "OPEN" } });
    if (!cart) return { ok: false, reason: "NO_CART" };
    const cartItems = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    if (cartItems.length === 0) return { ok: false, reason: "EMPTY_CART" };

    const lines = await this.toLines(cartItems);
    const fees = this.fees(cartItems.map((i) => i.shopId), input.deliveryFeePaiseByShop ?? {});
    const totals = computeQuote(lines, fees, input.discountPaise ?? 0);

    // metadata for snapshots (names/sku/tax) + stock rows
    const lvIds = cartItems.map((i) => i.listingVariantId);
    const lvMeta = await prisma.listingVariant.findMany({
      where: { id: { in: lvIds } },
      select: {
        id: true, variantId: true, sellerSku: true, mrpPaise: true, taxRateBp: true,
        listing: { select: { product: { select: { id: true, name: true } } } },
      },
    });
    const metaById = new Map(lvMeta.map((m) => [m.id, m]));
    const stockRows = await prisma.stock.findMany({
      where: { listingVariantId: { in: lvIds } },
      select: { id: true, listingVariantId: true, quantityOnHand: true, quantityReserved: true },
    });
    const stockByLv = new Map(stockRows.map((s) => [s.listingVariantId, s]));

    try {
      const result = await prisma.$transaction(async (tx) => {
        // allocate order number from a counter row (system_checks reused as seq)
        const seq = await this.nextSeq(tx);
        const no = orderNo(seq);

        const order = await tx.order.create({
          data: {
            orderNo: no, userId: input.userId, cityId: input.cityId,
            addressSnapshot: input.addressSnapshot as object,
            itemsTotalPaise: BigInt(totals.itemsTotalPaise),
            deliveryTotalPaise: BigInt(totals.deliveryTotalPaise),
            discountPaise: BigInt(totals.discountPaise),
            taxTotalPaise: BigInt(totals.taxTotalPaise),
            grandTotalPaise: BigInt(totals.grandTotalPaise),
            status: "PENDING_PAYMENT",
          },
        });

        // one seller_order per shop group
        const byShop = new Map<string, typeof cartItems>();
        for (const it of cartItems) {
          const arr = byShop.get(it.shopId) ?? [];
          arr.push(it); byShop.set(it.shopId, arr);
        }

        const shortfalls: Array<{ listingVariantId: string; requested: number; available: number }> = [];
        let shopIdx = 0;
        for (const [shopId, shopItems] of byShop) {
          const group = totals.shopGroups.find((g) => g.shopId === shopId)!;
          const so = await tx.sellerOrder.create({
            data: {
              orderId: order.id, shopId, sellerOrderNo: `${no}-${++shopIdx}`,
              itemsTotalPaise: BigInt(group.itemsTotalPaise),
              deliveryFeePaise: BigInt(group.deliveryFeePaise),
              taxTotalPaise: BigInt(group.taxPaise),
              status: "NEW", acceptDeadlineAt: new Date(Date.now() + 10 * 60 * 1000),
            },
          });

          for (const it of shopItems) {
            const meta = metaById.get(it.listingVariantId);
            const stock = stockByLv.get(it.listingVariantId);
            const unit = Number(it.addedPricePaise);

            // THE atomic reservation (M09) — oversell guard, inside this tx
            if (stock) {
              const affected = await tx.$executeRaw`
                UPDATE stock SET quantity_reserved = quantity_reserved + ${it.quantity}
                WHERE id = ${stock.id}::uuid
                  AND (quantity_on_hand - quantity_reserved) >= ${it.quantity}`;
              if (affected === 0) {
                shortfalls.push({ listingVariantId: it.listingVariantId, requested: it.quantity, available: stock.quantityOnHand - stock.quantityReserved });
                continue;
              }
              await tx.stockMovement.create({
                data: { stockId: stock.id, deltaOnHand: 0, deltaReserved: it.quantity, reason: "ORDER_RESERVE", referenceType: "order", referenceId: order.id },
              });
            }

            await tx.orderItem.create({
              data: {
                sellerOrderId: so.id, orderId: order.id, listingVariantId: it.listingVariantId,
                productId: meta?.listing.product.id, variantId: meta?.variantId,
                quantity: it.quantity, unitPricePaise: BigInt(unit),
                mrpPaise: meta ? meta.mrpPaise : null, taxRateBp: meta?.taxRateBp ?? 0,
                lineTotalPaise: BigInt(unit * it.quantity),
                nameSnapshot: meta?.listing.product.name ?? "item",
                skuSnapshot: meta?.sellerSku ?? "sku",
              },
            });
          }
        }

        if (shortfalls.length > 0) {
          // abort the whole transaction — nothing persists
          throw new InsufficientStock(shortfalls);
        }

        await tx.orderEvent.create({
          data: { orderId: order.id, event: "ORDER_PLACED", toStatus: "PLACED", actorType: "CUSTOMER", actorId: input.userId },
        });
        await tx.outboxEvent.create({
          data: { aggregateType: "order", aggregateId: order.id, eventType: "order.placed.v1", payload: { orderId: order.id, orderNo: no } },
        });
        const payment = await tx.payment.create({
          data: { orderId: order.id, provider: "COD", amountPaise: BigInt(totals.grandTotalPaise), status: "CREATED" },
        });
        await tx.order.update({ where: { id: order.id }, data: { status: "PLACED", placedAt: new Date(), paymentId: payment.id } });
        // close the cart
        await tx.cart.update({ where: { id: cart.id }, data: { status: "ORDERED" } });

        return { orderId: order.id, no, sellerOrderCount: byShop.size, grand: totals.grandTotalPaise };
      });

      return { ok: true, orderId: result.orderId, orderNo: result.no, sellerOrderCount: result.sellerOrderCount, grandTotalPaise: result.grand };
    } catch (e) {
      if (e instanceof InsufficientStock) return { ok: false, reason: "INSUFFICIENT_STOCK", shortfalls: e.shortfalls };
      throw e;
    }
  }

  // ---- helpers ----
  private async toLines(items: { listingVariantId: string; shopId: string; quantity: number; addedPricePaise: bigint }[]): Promise<QuoteLineInput[]> {
    const lvIds = items.map((i) => i.listingVariantId);
    const meta = await prisma.listingVariant.findMany({ where: { id: { in: lvIds } }, select: { id: true, taxRateBp: true } });
    const taxById = new Map(meta.map((m) => [m.id, m.taxRateBp]));
    return items.map((i) => ({
      shopId: i.shopId, listingVariantId: i.listingVariantId, quantity: i.quantity,
      unitPricePaise: Number(i.addedPricePaise), taxRateBp: taxById.get(i.listingVariantId) ?? 0,
    }));
  }

  private fees(shopIds: string[], provided: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const s of new Set(shopIds)) out[s] = provided[s] ?? DEFAULT_FEE;
    return out;
  }

  private async nextSeq(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]): Promise<number> {
    const key = `order_seq_${new Date().getUTCFullYear()}`;
    await tx.systemCheck.upsert({ where: { key }, update: {}, create: { key, value: "0" } });
    // single atomic statement: row lock serialises concurrent order placements
    const rows = await tx.$queryRaw<Array<{ value: string }>>`
      UPDATE system_checks SET value = (COALESCE(value, '0')::int + 1)::text, updated_at = now()
      WHERE key = ${key} RETURNING value`;
    return Number.parseInt(rows[0]!.value, 10);
  }
}

class InsufficientStock extends Error {
  constructor(public readonly shortfalls: Array<{ listingVariantId: string; requested: number; available: number }>) {
    super("insufficient stock");
  }
}
