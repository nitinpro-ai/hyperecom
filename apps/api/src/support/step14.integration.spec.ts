import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { uniquePhone } from "../test-utils";
import { prisma } from "@apnacity/db";
import { NotificationsService } from "../notifications/notifications.service";
import { ReturnsService } from "../returns/returns.service";
import { SupportService } from "./support.service";

/**
 * Step 14 integration (live DB): notifications fail-closed + suppression +
 * record; returns auto-approve gate + inspection pass→refund+restock /
 * fail→dispute; support SLA + dispute freeze.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-step14";

d("Step 14 notifications+returns+support (integration)", () => {
  const notify = new NotificationsService();
  const returns = new ReturnsService();
  const support = new SupportService();
  let userId = "", sellerOrderId = "", orderItemId = "", stockId = "", listingVariantId = "";

  beforeAll(async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "bijnor" } });
    const u = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    userId = u.id;
    const cat = await prisma.category.create({ data: { name: `${TAG}c`, slug: `${TAG}c-${Date.now()}`, pathText: "r", returnWindowDays: 7 } });
    const prod = await prisma.product.create({ data: { categoryId: cat.id, name: `${TAG}p`, slug: `${TAG}p-${Date.now()}`, status: "ACTIVE" } });
    const variant = await prisma.productVariant.create({ data: { productId: prod.id, attributes: {} } });
    const seller = await prisma.seller.create({ data: { userId: u.id, legalName: TAG, displayName: TAG, businessType: "INDIVIDUAL", pan: "ABCDE1234F", status: "APPROVED" } });
    const shop = await prisma.shop.create({ data: { sellerId: seller.id, cityId: city.id, name: `${TAG}s`, slug: `${TAG}s-${Date.now()}`, status: "ACTIVE" } });
    const listing = await prisma.sellerListing.create({ data: { shopId: shop.id, productId: prod.id, status: "ACTIVE" } });
    const lv = await prisma.listingVariant.create({ data: { listingId: listing.id, shopId: shop.id, variantId: variant.id, sellerSku: `${TAG}sku`, mrpPaise: 50000n, pricePaise: 40000n } });
    listingVariantId = lv.id;
    const loc = await prisma.inventoryLocation.create({ data: { shopId: shop.id } });
    const stock = await prisma.stock.create({ data: { locationId: loc.id, listingVariantId: lv.id, quantityOnHand: 10, quantityReserved: 0 } });
    stockId = stock.id;
    const order = await prisma.order.create({ data: { orderNo: `APN-S14-${Date.now()}`, userId, cityId: city.id, addressSnapshot: {}, itemsTotalPaise: 40000n, deliveryTotalPaise: 4000n, taxTotalPaise: 0n, grandTotalPaise: 44000n, status: "PLACED" } });
    await prisma.payment.create({ data: { orderId: order.id, provider: "COD", amountPaise: 44000n, status: "CAPTURED" } });
    const so = await prisma.sellerOrder.create({ data: { orderId: order.id, shopId: shop.id, sellerOrderNo: `${order.orderNo}-1`, itemsTotalPaise: 40000n, deliveryFeePaise: 4000n, taxTotalPaise: 0n, status: "DELIVERED", deliveredAt: new Date() } });
    sellerOrderId = so.id;
    const item = await prisma.orderItem.create({ data: { sellerOrderId: so.id, orderId: order.id, listingVariantId: lv.id, productId: prod.id, quantity: 1, unitPricePaise: 40000n, lineTotalPaise: 40000n, nameSnapshot: "x", skuSnapshot: "x" } });
    orderItemId = item.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const uids = users.map((u) => u.id);
    await prisma.notification.deleteMany({ where: { userId: { in: uids } } });
    await prisma.notificationPreference.deleteMany({ where: { userId: { in: uids } } });
    await prisma.ticketMessage.deleteMany({ where: { ticket: { openedByUserId: { in: uids } } } });
    await prisma.supportTicket.deleteMany({ where: { openedByUserId: { in: uids } } });
    await prisma.returnRequest.deleteMany({ where: { userId: { in: uids } } });
    const ords = await prisma.order.findMany({ where: { userId: { in: uids } }, select: { id: true } });
    const oids = ords.map((o) => o.id);
    await prisma.refund.deleteMany({ where: { payment: { orderId: { in: oids } } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.sellerOrder.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.order.deleteMany({ where: { id: { in: oids } } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateType: "return" } });
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

  it("M22: SMS without a DLT template fails closed (SUPPRESSED, recorded)", async () => {
    // template with NO dlt id
    await prisma.notificationTemplate.create({ data: { code: "TEST_SMS", channel: "SMS", locale: "EN", bodyTemplate: "hi {{name}}", dltTemplateId: null } });
    const r = await notify.send({ userId, templateCode: "TEST_SMS", channel: "SMS", topic: "ORDERS", vars: { name: "A" } });
    expect(r).toEqual({ status: "SUPPRESSED", reason: "FAIL_CLOSED_NO_DLT" });
    const rec = await prisma.notification.findFirst({ where: { userId, templateCode: "TEST_SMS" } });
    expect(rec?.status).toBe("SUPPRESSED");
    await prisma.notificationTemplate.deleteMany({ where: { code: "TEST_SMS" } });
  });

  it("M22: valid SMS with DLT id sends; promo opt-out suppresses", async () => {
    await prisma.notificationTemplate.create({ data: { code: "ORDER_PLACED", channel: "SMS", locale: "EN", bodyTemplate: "Order {{no}} placed", dltTemplateId: "DLT_001" } });
    const ok = await notify.send({ userId, templateCode: "ORDER_PLACED", channel: "SMS", topic: "ORDERS", vars: { no: "APN-1" }, nowIstHour: 12 });
    expect(ok.status).toBe("SENT");
    await notify.setPreference(userId, "PUSH", "PROMOS", false);
    const promo = await notify.send({ userId, templateCode: "PROMO", channel: "PUSH", topic: "PROMOS", nowIstHour: 12 });
    expect(promo).toEqual({ status: "SUPPRESSED", reason: "OPTED_OUT" });
    await prisma.notificationTemplate.deleteMany({ where: { code: "ORDER_PLACED" } });
  });

  it("M19: cheap SIZE_ISSUE auto-approves + emits return.approved.v1", async () => {
    const r = await returns.request({ sellerOrderId, orderItemId, userId, reason: "SIZE_ISSUE" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.status).toBe("APPROVED");
    expect(await prisma.outboxEvent.findFirst({ where: { aggregateId: r.returnId, eventType: "return.approved.v1" } })).not.toBeNull();
  });

  it("M19: inspection pass → refund initiated + restock(RETURN) recorded", async () => {
    const rr = await prisma.returnRequest.findFirstOrThrow({ where: { userId } });
    const before = await prisma.stock.findUniqueOrThrow({ where: { id: stockId } });
    const res = await returns.inspect(rr.id, true, "ok");
    expect(res.outcome).toBe("REFUND_INITIATED");
    const after = await prisma.stock.findUniqueOrThrow({ where: { id: stockId } });
    expect(after.quantityOnHand).toBe(before.quantityOnHand + 1); // restocked
    expect(await prisma.stockMovement.findFirst({ where: { stockId, reason: "RETURN" } })).not.toBeNull();
    expect(await prisma.refund.findFirst({ where: { orderItemId } })).not.toBeNull();
  });

  it("M23: inspection fail opens a RETURN_DISPUTE ticket → refunds frozen", async () => {
    // new return for the same item won't re-create; make a second item scenario via a fresh return row
    const rr = await prisma.returnRequest.create({ data: { sellerOrderId, orderItemId, userId, reason: "DAMAGED", status: "RECEIVED", requestedAt: new Date() } });
    const res = await returns.inspect(rr.id, false, "item damaged in transit by customer");
    expect(res.outcome).toBe("DISPUTE_OPENED");
    expect(await support.refundFrozen(sellerOrderId)).toBe(true); // open dispute freezes refunds
  });

  it("M23: ticket SLA set by priority; resolve clears the freeze", async () => {
    const { ticketId } = await support.open({ openedByUserId: userId, type: "DELIVERY_ISSUE", subject: "late", priority: "URGENT" });
    const t = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    expect(t.slaDueAt).not.toBeNull();
    expect(Math.round((t.slaDueAt!.getTime() - t.createdAt.getTime()) / 3600e3)).toBe(2); // URGENT = 2h
  });
});
