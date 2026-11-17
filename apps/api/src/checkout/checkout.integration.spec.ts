import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { uniquePhone } from "../test-utils";
import { prisma } from "@apnacity/db";
import { CartService } from "../cart/cart.service";
import { CheckoutService } from "./checkout.service";
import { PaymentsService, PAYMENT_PROVIDER } from "../payments/payments.service";
import { MockPaymentProvider } from "../payments/payment-provider.port";

/**
 * Step 11 gate (integration, live DB): 3-shop cart → place → parent + 3 seller
 * orders PLACED + stock reserved; per-item 422 on insufficient stock (nothing
 * written); webhook captures; replayed webhook ignored. Self-cleans.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-step11";

d("Step 11 purchase flow (integration)", () => {
  const cart = new CartService();
  const checkout = new CheckoutService();
  const payments = new PaymentsService(new MockPaymentProvider());
  let userId = "", cityId = "";
  const lvByShop: Record<string, { lvId: string; stockId: string }> = {};
  const shopIds: string[] = [];

  beforeAll(async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "bijnor" } });
    cityId = city.id;
    const u = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    userId = u.id;
    const cat = await prisma.category.create({ data: { name: `${TAG}-c`, slug: `${TAG}-c-${Date.now()}`, pathText: "root.c" } });
    const product = await prisma.product.create({ data: { categoryId: cat.id, name: `${TAG}-p`, slug: `${TAG}-p-${Date.now()}`, status: "ACTIVE" } });
    const variant = await prisma.productVariant.create({ data: { productId: product.id, attributes: {} } });

    // 3 shops, each with a listing + variant + stock
    for (let i = 0; i < 3; i++) {
      const su = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
      const seller = await prisma.seller.create({ data: { userId: su.id, legalName: `${TAG}${i}`, displayName: `${TAG}${i}`, businessType: "INDIVIDUAL", pan: "ABCDE1234F", status: "APPROVED" } });
      const shop = await prisma.shop.create({ data: { sellerId: seller.id, cityId, name: `${TAG}-shop${i}`, slug: `${TAG}-shop${i}-${Date.now()}`, status: "ACTIVE" } });
      shopIds.push(shop.id);
      const listing = await prisma.sellerListing.create({ data: { shopId: shop.id, productId: product.id, status: "ACTIVE" } });
      const lv = await prisma.listingVariant.create({ data: { listingId: listing.id, shopId: shop.id, variantId: variant.id, sellerSku: `${TAG}-sku${i}`, mrpPaise: 100000n, pricePaise: BigInt(70000 + i * 5000), taxRateBp: 500 } });
      const loc = await prisma.inventoryLocation.create({ data: { shopId: shop.id, name: "Floor" } });
      const stock = await prisma.stock.create({ data: { locationId: loc.id, listingVariantId: lv.id, quantityOnHand: i === 2 ? 0 : 10, quantityReserved: 0 } });
      lvByShop[shop.id] = { lvId: lv.id, stockId: stock.id };
    }
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const uids = users.map((u) => u.id);
    const orders = await prisma.order.findMany({ where: { userId: { in: uids } }, select: { id: true } });
    const oids = orders.map((o) => o.id);
    await prisma.paymentTransaction.deleteMany({ where: { payment: { orderId: { in: oids } } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.orderEvent.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.sellerOrder.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.order.deleteMany({ where: { id: { in: oids } } });
    await prisma.webhookEvent.deleteMany({ where: { provider: "MOCK" } });
    const carts = await prisma.cart.findMany({ where: { userId: { in: uids } }, select: { id: true } });
    await prisma.cartItem.deleteMany({ where: { cartId: { in: carts.map((c) => c.id) } } });
    await prisma.cart.deleteMany({ where: { userId: { in: uids } } });
    const shops = await prisma.shop.findMany({ where: { name: { startsWith: `${TAG}-shop` } }, select: { id: true } });
    const sids = shops.map((s) => s.id);
    const lvs = await prisma.listingVariant.findMany({ where: { shopId: { in: sids } }, select: { id: true } });
    const lvids = lvs.map((l) => l.id);
    const stocks = await prisma.stock.findMany({ where: { listingVariantId: { in: lvids } }, select: { id: true } });
    await prisma.stockMovement.deleteMany({ where: { stockId: { in: stocks.map((s) => s.id) } } });
    await prisma.stock.deleteMany({ where: { listingVariantId: { in: lvids } } });
    await prisma.inventoryLocation.deleteMany({ where: { shopId: { in: sids } } });
    await prisma.listingVariant.deleteMany({ where: { shopId: { in: sids } } });
    await prisma.sellerListing.deleteMany({ where: { shopId: { in: sids } } });
    await prisma.shop.deleteMany({ where: { id: { in: sids } } });
    await prisma.seller.deleteMany({ where: { userId: { in: uids } } });
    await prisma.productVariant.deleteMany({ where: { product: { name: `${TAG}-p` } } });
    await prisma.product.deleteMany({ where: { name: `${TAG}-p` } });
    await prisma.category.deleteMany({ where: { name: `${TAG}-c` } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
    await prisma.$disconnect();
  });

  it("per-item 422 when a shop is out of stock — NOTHING written", async () => {
    // add all 3 shops incl. the out-of-stock one
    for (const shopId of shopIds) {
      const { lvId } = lvByShop[shopId]!;
      const lv = await prisma.listingVariant.findUniqueOrThrow({ where: { id: lvId } });
      await cart.addItem({ userId, cityId, listingVariantId: lvId, listingId: lv.listingId, shopId, quantity: 1 });
    }
    const res = await checkout.placeOrder({ userId, cityId, addressSnapshot: { line1: "x", pincode: "246701" } });
    expect(res.ok).toBe(false);
    if (!res.ok && res.reason === "INSUFFICIENT_STOCK") expect(res.shortfalls.length).toBeGreaterThan(0);
    // nothing written
    expect(await prisma.order.count({ where: { userId } })).toBe(0);
    // no stock reserved anywhere (rollback)
    for (const shopId of shopIds) {
      const s = await prisma.stock.findUniqueOrThrow({ where: { id: lvByShop[shopId]!.stockId } });
      expect(s.quantityReserved).toBe(0);
    }
  });

  it("3-shop place (after fixing stock) → parent + 3 seller orders PLACED + stock reserved", async () => {
    // give the 3rd shop stock
    await prisma.stock.update({ where: { id: lvByShop[shopIds[2]!]!.stockId }, data: { quantityOnHand: 10 } });
    const res = await checkout.placeOrder({ userId, cityId, addressSnapshot: { line1: "x", pincode: "246701" } });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sellerOrderCount).toBe(3);
    expect(res.orderNo).toMatch(/^APN-\d{4}-\d{6}$/);

    const order = await prisma.order.findUniqueOrThrow({ where: { id: res.orderId } });
    expect(order.status).toBe("PLACED");
    expect(await prisma.sellerOrder.count({ where: { orderId: res.orderId } })).toBe(3);
    expect(await prisma.orderItem.count({ where: { orderId: res.orderId } })).toBe(3);
    // stock reserved in each shop
    for (const shopId of shopIds) {
      const s = await prisma.stock.findUniqueOrThrow({ where: { id: lvByShop[shopId]!.stockId } });
      expect(s.quantityReserved).toBe(1);
    }
    // order.placed.v1 emitted
    expect(await prisma.outboxEvent.findFirst({ where: { aggregateId: res.orderId, eventType: "order.placed.v1" } })).not.toBeNull();
  });

  it("webhook captures the payment; replayed webhook is ignored", async () => {
    const order = await prisma.order.findFirstOrThrow({ where: { userId }, orderBy: { createdAt: "desc" } });
    const payment = await prisma.payment.findFirstOrThrow({ where: { orderId: order.id } });
    const ref = `ref-${Date.now()}`; // unique per run — shared CI DB has prior webhook_events
    await prisma.payment.update({ where: { id: payment.id }, data: { providerOrderRef: ref } });

    const body = JSON.stringify({ externalRef: ref, status: "CAPTURED", amountPaise: Number(payment.amountPaise) });
    const sig = MockPaymentProvider.sign(body);

    const first = await payments.handleWebhook(body, sig);
    expect(first).toEqual({ ok: true, outcome: "CAPTURED" });
    const captured = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(captured.status).toBe("CAPTURED");

    // replay — same payload → ignored (replay guard)
    const second = await payments.handleWebhook(body, sig);
    expect(second).toEqual({ ok: true, outcome: "IGNORED_REPLAY" });

    // bad signature → rejected
    const bad = await payments.handleWebhook(body, "deadbeef");
    expect(bad).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });
});
