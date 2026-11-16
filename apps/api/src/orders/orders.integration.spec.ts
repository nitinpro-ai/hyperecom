import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { OrdersService } from "./orders.service";

/**
 * M14 OMS integration (live DB): build a placed order with stock reserved, then
 * drive transitions — accept→dispatch consumes stock; reject releases stock +
 * creates a refund; 10-min timeout auto-rejects; illegal transition → 409.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-m14";

d("M14 OMS transitions (integration)", () => {
  const orders = new OrdersService();
  let userId = "", orderId = "", so1 = "", so2 = "", stockId1 = "", stockId2 = "", lv1 = "", lv2 = "";

  async function freshOrder(reserveQty = 1) {
    // minimal order with 2 seller orders, each 1 item + reserved stock
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "bijnor" } });
    const u = await prisma.user.create({ data: { phone: `+91${String(Date.now()).slice(-9)}`, name: TAG } });
    const cat = await prisma.category.create({ data: { name: `${TAG}c`, slug: `${TAG}c-${Date.now()}`, pathText: "r" } });
    const prod = await prisma.product.create({ data: { categoryId: cat.id, name: `${TAG}p`, slug: `${TAG}p-${Date.now()}`, status: "ACTIVE" } });
    const variant = await prisma.productVariant.create({ data: { productId: prod.id, attributes: {} } });
    const order = await prisma.order.create({ data: { orderNo: `APN-TEST-${Date.now()}`, userId: u.id, cityId: city.id, addressSnapshot: {}, itemsTotalPaise: 140000n, deliveryTotalPaise: 8000n, taxTotalPaise: 0n, grandTotalPaise: 148000n, status: "PLACED", placedAt: new Date() } });
    await prisma.payment.create({ data: { orderId: order.id, provider: "COD", amountPaise: 148000n, status: "CREATED" } });
    const sos: string[] = []; const stocks: string[] = []; const lvs: string[] = [];
    for (let i = 0; i < 2; i++) {
      const su = await prisma.user.create({ data: { phone: `+9177${String(Date.now()).slice(-7)}${i}`, name: TAG } });
      const seller = await prisma.seller.create({ data: { userId: su.id, legalName: `${TAG}${i}`, displayName: `${TAG}${i}`, businessType: "INDIVIDUAL", pan: "ABCDE1234F", status: "APPROVED" } });
      const shop = await prisma.shop.create({ data: { sellerId: seller.id, cityId: city.id, name: `${TAG}s${i}`, slug: `${TAG}s${i}-${Date.now()}`, status: "ACTIVE" } });
      const listing = await prisma.sellerListing.create({ data: { shopId: shop.id, productId: prod.id, status: "ACTIVE" } });
      const lv = await prisma.listingVariant.create({ data: { listingId: listing.id, shopId: shop.id, variantId: variant.id, sellerSku: `${TAG}${i}${Date.now()}`, mrpPaise: 100000n, pricePaise: 70000n } });
      const loc = await prisma.inventoryLocation.create({ data: { shopId: shop.id } });
      const stock = await prisma.stock.create({ data: { locationId: loc.id, listingVariantId: lv.id, quantityOnHand: 10, quantityReserved: reserveQty } });
      const so = await prisma.sellerOrder.create({ data: { orderId: order.id, shopId: shop.id, sellerOrderNo: `${order.orderNo}-${i}`, itemsTotalPaise: 70000n, deliveryFeePaise: 4000n, taxTotalPaise: 0n, status: "NEW", acceptDeadlineAt: new Date(Date.now() + 600000) } });
      await prisma.orderItem.create({ data: { sellerOrderId: so.id, orderId: order.id, listingVariantId: lv.id, quantity: reserveQty, unitPricePaise: 70000n, lineTotalPaise: 70000n, nameSnapshot: "x", skuSnapshot: "x" } });
      sos.push(so.id); stocks.push(stock.id); lvs.push(lv.id);
    }
    return { userId: u.id, orderId: order.id, so1: sos[0]!, so2: sos[1]!, stockId1: stocks[0]!, stockId2: stocks[1]!, lv1: lvs[0]!, lv2: lvs[1]! };
  }

  beforeAll(async () => { ({ userId, orderId, so1, so2, stockId1, stockId2, lv1, lv2 } = await freshOrder()); });

  afterAll(async () => {
    // broad tagged cleanup
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const uids = users.map((u) => u.id);
    const ords = await prisma.order.findMany({ where: { userId: { in: uids } }, select: { id: true } });
    const oids = ords.map((o) => o.id);
    await prisma.refund.deleteMany({ where: { payment: { orderId: { in: oids } } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.orderEvent.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.sellerOrder.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.order.deleteMany({ where: { id: { in: oids } } });
    const shops = await prisma.shop.findMany({ where: { name: { startsWith: `${TAG}s` } }, select: { id: true } });
    const sids = shops.map((s) => s.id);
    const lvs = await prisma.listingVariant.findMany({ where: { shopId: { in: sids } }, select: { id: true } });
    const stocks = await prisma.stock.findMany({ where: { listingVariantId: { in: lvs.map((l) => l.id) } }, select: { id: true } });
    await prisma.stockMovement.deleteMany({ where: { stockId: { in: stocks.map((s) => s.id) } } });
    await prisma.stock.deleteMany({ where: { id: { in: stocks.map((s) => s.id) } } });
    await prisma.inventoryLocation.deleteMany({ where: { shopId: { in: sids } } });
    await prisma.listingVariant.deleteMany({ where: { shopId: { in: sids } } });
    await prisma.sellerListing.deleteMany({ where: { shopId: { in: sids } } });
    await prisma.shop.deleteMany({ where: { id: { in: sids } } });
    await prisma.seller.deleteMany({ where: { userId: { in: uids } } });
    await prisma.productVariant.deleteMany({ where: { product: { name: `${TAG}p` } } });
    await prisma.product.deleteMany({ where: { name: `${TAG}p` } });
    await prisma.category.deleteMany({ where: { name: `${TAG}c` } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
    await prisma.$disconnect();
  });

  it("illegal transition (NEW→DISPATCH) → 409", async () => {
    const r = await orders.transition(so1, "DISPATCH", "SELLER");
    expect(r).toMatchObject({ ok: false, code: 409 });
  });

  it("wrong role (customer accept) → 409", async () => {
    const r = await orders.transition(so1, "ACCEPT", "CUSTOMER");
    expect(r).toMatchObject({ ok: false, code: 409 });
  });

  it("accept→preparing→ready→dispatch consumes stock + writes events", async () => {
    expect((await orders.transition(so1, "ACCEPT", "SELLER")).ok).toBe(true);
    expect((await orders.transition(so1, "PREPARING", "SELLER")).ok).toBe(true);
    expect((await orders.transition(so1, "READY", "SELLER")).ok).toBe(true);
    const disp = await orders.transition(so1, "DISPATCH", "SELLER");
    expect(disp.ok).toBe(true);
    const s = await prisma.stock.findUniqueOrThrow({ where: { id: stockId1 } });
    expect(s.quantityOnHand).toBe(9); // consumed 1
    expect(s.quantityReserved).toBe(0);
    expect(await prisma.orderEvent.count({ where: { sellerOrderId: so1 } })).toBeGreaterThanOrEqual(4);
    // parent now PARTIALLY in progress (so2 still NEW) → PLACED
    const parent = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(parent.status).toBe("PLACED");
  });

  it("reject (so2) releases stock + creates a refund + parent PARTIALLY_CANCELLED", async () => {
    const r = await orders.transition(so2, "REJECT", "SELLER", undefined, "out of stock");
    expect(r.ok).toBe(true);
    const s = await prisma.stock.findUniqueOrThrow({ where: { id: stockId2 } });
    expect(s.quantityReserved).toBe(0); // released
    expect(await prisma.refund.count({ where: { sellerOrderId: so2 } })).toBe(1);
    const parent = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(parent.status).toBe("PARTIALLY_CANCELLED"); // so1 dispatched, so2 rejected
  });

  it("10-min timeout sweep auto-rejects NEW orders past deadline", async () => {
    const fresh = await freshOrder();
    // force the deadline into the past
    await prisma.sellerOrder.updateMany({ where: { orderId: fresh.orderId }, data: { acceptDeadlineAt: new Date(Date.now() - 1000) } });
    const n = await orders.sweepTimeouts();
    expect(n).toBeGreaterThanOrEqual(2);
    const so = await prisma.sellerOrder.findUniqueOrThrow({ where: { id: fresh.so1 } });
    expect(so.status).toBe("REJECTED");
    expect(so.rejectedReason).toBe("accept timeout");
    // stock released
    const s = await prisma.stock.findUniqueOrThrow({ where: { id: fresh.stockId1 } });
    expect(s.quantityReserved).toBe(0);
  });
});
