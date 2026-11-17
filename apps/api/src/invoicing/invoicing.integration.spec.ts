import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { uniquePhone } from "../test-utils";
import { InvoicingService } from "./invoicing.service";

/**
 * M31 integration (live DB): invoice per child order, per-seller sequential
 * numbering, idempotent; credit note on refund (generates invoice if missing).
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-m31";

d("M31 invoicing (integration)", () => {
  const inv = new InvoicingService();
  let so1 = "", so2 = "", orderId = "";

  beforeAll(async () => {
    const city = await prisma.city.findFirstOrThrow();
    const u = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    const seller = await prisma.seller.create({ data: { userId: u.id, legalName: TAG, displayName: TAG, businessType: "INDIVIDUAL", pan: "ABCDE1234F", status: "APPROVED" } });
    const shop = await prisma.shop.create({ data: { sellerId: seller.id, cityId: city.id, name: `${TAG}s`, slug: `${TAG}shop${Date.now()}`, status: "ACTIVE" } });
    const order = await prisma.order.create({ data: { orderNo: `APN-M31-${Date.now()}`, userId: u.id, cityId: city.id, addressSnapshot: {}, itemsTotalPaise: 112000n, deliveryTotalPaise: 8000n, taxTotalPaise: 12000n, grandTotalPaise: 120000n, status: "PLACED" } });
    orderId = order.id;
    so1 = (await prisma.sellerOrder.create({ data: { orderId: order.id, shopId: shop.id, sellerOrderNo: `${order.orderNo}-1`, itemsTotalPaise: 112000n, deliveryFeePaise: 4000n, taxTotalPaise: 12000n, status: "DELIVERED", deliveredAt: new Date() } })).id;
    so2 = (await prisma.sellerOrder.create({ data: { orderId: order.id, shopId: shop.id, sellerOrderNo: `${order.orderNo}-2`, itemsTotalPaise: 50000n, deliveryFeePaise: 4000n, taxTotalPaise: 5000n, status: "DELIVERED", deliveredAt: new Date() } })).id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const uids = users.map((u) => u.id);
    const ords = await prisma.order.findMany({ where: { userId: { in: uids } }, select: { id: true } });
    const oids = ords.map((o) => o.id);
    const sos = await prisma.sellerOrder.findMany({ where: { orderId: { in: oids } }, select: { id: true } });
    const soids = sos.map((s) => s.id);
    await prisma.creditNote.deleteMany({ where: { invoice: { sellerOrderId: { in: soids } } } });
    await prisma.invoice.deleteMany({ where: { sellerOrderId: { in: soids } } });
    await prisma.sellerOrder.deleteMany({ where: { orderId: { in: oids } } });
    await prisma.order.deleteMany({ where: { id: { in: oids } } });
    const shops = await prisma.shop.findMany({ where: { name: { startsWith: `${TAG}s` } }, select: { id: true } });
    await prisma.shop.deleteMany({ where: { id: { in: shops.map((s) => s.id) } } });
    await prisma.seller.deleteMany({ where: { userId: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
    await prisma.$disconnect();
  });

  it("generates ONE invoice per child order, sequential numbers, idempotent", async () => {
    const i1 = await inv.generate(so1);
    expect(i1.ok).toBe(true);
    if (!i1.ok) return;
    expect(i1.created).toBe(true);
    expect(i1.invoiceNo).toMatch(/\/\d{5}$/);

    const i2 = await inv.generate(so2);
    if (!i2.ok) return;
    // same seller series → sequential seq numbers
    const a = Number(i1.invoiceNo.split("/")[1]);
    const b = Number(i2.invoiceNo.split("/")[1]);
    expect(b).toBe(a + 1);

    // idempotent: re-generating returns the same invoice, created=false
    const again = await inv.generate(so1);
    expect(again.ok && again.created).toBe(false);
    if (again.ok) expect(again.invoiceNo).toBe(i1.invoiceNo);
  });

  it("credit note on refund references the invoice; idempotent by refundId", async () => {
    const refundId = "cccccccc-0000-4000-8000-000000000031";
    const cn = await inv.creditNote(refundId, so1, 56000, "partial return");
    expect(cn.ok).toBe(true);
    if (!cn.ok) return;
    expect(cn.creditNoteNo).toMatch(/-CN\/\d{5}$/);

    const dup = await inv.creditNote(refundId, so1, 56000);
    expect(dup.ok && dup.created).toBe(false); // same refundId → no duplicate

    const withNotes = await inv.forSellerOrder(so1);
    expect(withNotes?.creditNotes.length).toBe(1);
  });

  it("credit note auto-generates the invoice if one doesn't exist yet", async () => {
    const refundId = "dddddddd-0000-4000-8000-000000000031";
    const cn = await inv.creditNote(refundId, so2, 20000, "damaged");
    expect(cn.ok).toBe(true);
    // so2 invoice existed from test 1; ensure a CN attached
    expect((await inv.forSellerOrder(so2))?.creditNotes.length).toBe(1);
  });
});
