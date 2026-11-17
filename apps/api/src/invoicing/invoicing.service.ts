import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { invoiceNo, creditNoteNo, gstSeries } from "./invoicing.core";

export type GenerateResult =
  | { ok: true; invoiceId: string; invoiceNo: string; created: boolean }
  | { ok: false; reason: "SELLER_ORDER_NOT_FOUND" };

/**
 * M31 — Invoicing. One GST tax invoice per child (seller) order, per-seller
 * sequential series; credit note per refund. e-invoice IRN is a hook (set when
 * the IRP is integrated). Idempotent: invoice keyed by sellerOrderId.
 */
@Injectable()
export class InvoicingService {
  /** Generate (or return existing) the invoice for a seller order. */
  async generate(sellerOrderId: string): Promise<GenerateResult> {
    const existing = await prisma.invoice.findUnique({ where: { sellerOrderId } });
    if (existing) return { ok: true, invoiceId: existing.id, invoiceNo: existing.invoiceNo, created: false };

    const so = await prisma.sellerOrder.findUnique({
      where: { id: sellerOrderId },
      select: { id: true, shopId: true, itemsTotalPaise: true, taxTotalPaise: true, deliveryFeePaise: true },
    });
    if (!so) return { ok: false, reason: "SELLER_ORDER_NOT_FOUND" };
    const shop = await prisma.shop.findUnique({ where: { id: so.shopId }, select: { sellerId: true, slug: true } });
    if (!shop) return { ok: false, reason: "SELLER_ORDER_NOT_FOUND" };

    const series = gstSeries(shop.slug.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "SELLER");
    const grand = so.itemsTotalPaise + so.deliveryFeePaise;

    const invoice = await prisma.$transaction(async (tx) => {
      const seq = await this.nextSeq(tx, `inv_${series}`);
      return tx.invoice.create({
        data: {
          sellerOrderId, sellerId: shop.sellerId, series, seqNo: seq,
          invoiceNo: invoiceNo(series, seq),
          taxableValuePaise: so.itemsTotalPaise - so.taxTotalPaise,
          taxTotalPaise: so.taxTotalPaise, grandTotalPaise: grand,
        },
      });
    });
    return { ok: true, invoiceId: invoice.id, invoiceNo: invoice.invoiceNo, created: true };
  }

  /** Credit note on refund (item- or order-scoped). Idempotent by refundId. */
  async creditNote(refundId: string, sellerOrderId: string, amountPaise: number, reason?: string) {
    const existing = await prisma.creditNote.findUnique({ where: { refundId } });
    if (existing) return { ok: true as const, creditNoteId: existing.id, creditNoteNo: existing.creditNoteNo, created: false };

    const invoice = await prisma.invoice.findUnique({ where: { sellerOrderId } });
    if (!invoice) {
      // generate the invoice first, then the credit note against it
      const gen = await this.generate(sellerOrderId);
      if (!gen.ok) return { ok: false as const, reason: "NO_INVOICE" };
    }
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { sellerOrderId } });

    const cn = await prisma.$transaction(async (tx) => {
      const seq = await this.nextSeq(tx, `cn_${inv.series}`);
      return tx.creditNote.create({
        data: {
          invoiceId: inv.id, refundId, series: inv.series, seqNo: seq,
          creditNoteNo: creditNoteNo(inv.series, seq), amountPaise: BigInt(amountPaise), reason: reason ?? null,
        },
      });
    });
    return { ok: true as const, creditNoteId: cn.id, creditNoteNo: cn.creditNoteNo, created: true };
  }

  async forSellerOrder(sellerOrderId: string) {
    return prisma.invoice.findUnique({ where: { sellerOrderId }, include: { creditNotes: true } });
  }

  private async nextSeq(tx: any, key: string): Promise<number> {
    const k = `invseq_${key}`;
    const row = await tx.systemCheck.upsert({ where: { key: k }, update: {}, create: { key: k, value: "0" } });
    const next = Number.parseInt(row.value ?? "0", 10) + 1;
    await tx.systemCheck.update({ where: { key: k }, data: { value: String(next) } });
    return next;
  }
}
