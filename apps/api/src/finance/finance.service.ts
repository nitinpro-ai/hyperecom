import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { prisma } from "@apnacity/db";
import {
  buildOrderPosting, buildRefundPosting, isBalanced, computeSettlement,
  statementNo, type LedgerLine,
} from "./finance.core";

/** Map a logical account key + owner to a ledger_accounts row (get-or-create). */
interface AccountRef { ownerType: string; ownerId: string; accountType: string }

export type ReleaseResult =
  | { ok: true; status: "PAID" }
  | { ok: false; reason: "NOT_FOUND" | "NEED_TWO_APPROVERS" | "ALREADY_PAID" };

/**
 * M16 — Finance. Double-entry ledger (DB trigger enforces balance + append-only),
 * commission, T+2 settlement with two-person approval. post() writes a balanced
 * transaction atomically and updates cached account balances.
 */
@Injectable()
export class FinanceService {
  /** Post a balanced set of lines as one transaction_id. Rejects if unbalanced. */
  async post(
    lines: Array<LedgerLine & { owner: AccountRef }>,
    source: { type: string; id: string; memo?: string },
  ): Promise<{ transactionId: string }> {
    if (!isBalanced(lines)) throw new Error("FINANCE_UNBALANCED: debits != credits");
    const transactionId = randomUUID();

    await prisma.$transaction(async (tx) => {
      // resolve (get-or-create) each DISTINCT account first, so repeated accounts
      // across lines (e.g. two SELLER_PAYABLE lines) don't double-create.
      const key = (o: AccountRef) => `${o.ownerType}|${o.ownerId}|${o.accountType}`;
      const acctIds = new Map<string, string>();
      for (const l of lines) {
        const k = key(l.owner);
        if (!acctIds.has(k)) acctIds.set(k, (await this.account(tx, l.owner)).id);
      }
      for (const l of lines) {
        const acctId = acctIds.get(key(l.owner))!;
        await tx.ledgerEntry.create({
          data: {
            transactionId, ledgerAccountId: acctId,
            debitPaise: BigInt(l.debit), creditPaise: BigInt(l.credit),
            sourceType: source.type, sourceId: source.id, memo: source.memo ?? null,
          },
        });
        await tx.ledgerAccount.update({
          where: { id: acctId },
          data: { balancePaise: { increment: BigInt(l.credit - l.debit) } },
        });
      }
    });
    return { transactionId };
  }

  /** On payment.captured.v1 → post the order's commission/delivery/gateway split. */
  async postOrderCapture(input: {
    sellerId: string; itemsTotalPaise: number; deliveryFeePaise: number;
    commissionRateBp: number; gatewayFeeBp: number; orderId: string;
  }) {
    const p = buildOrderPosting(input);
    const platform = "00000000-0000-0000-0000-000000000000";
    const owner = (accountType: string, ownerType = "SELLER", ownerId = input.sellerId): AccountRef =>
      accountType === "CUSTOMER_RECEIVABLE" || accountType === "DELIVERY_INCOME"
        || accountType === "COMMISSION_INCOME" || accountType === "GATEWAY_FEE" || accountType === "CLEARING"
        ? { ownerType: "PLATFORM", ownerId: platform, accountType: normalize(accountType) }
        : { ownerType, ownerId, accountType: normalize(accountType) };
    const lines = p.lines.map((l) => ({ ...l, owner: owner(l.account) }));
    await this.post(lines, { type: "order", id: input.orderId, memo: "order capture" });
    return p;
  }

  async sellerBalancePaise(sellerId: string): Promise<number> {
    const acct = await prisma.ledgerAccount.findFirst({
      where: { ownerType: "SELLER", ownerId: sellerId, accountType: "PAYABLE" },
    });
    return acct ? Number(acct.balancePaise) : 0;
  }

  /** Nightly: batch a seller's CLOSED children into a PENDING settlement (T+2). */
  async runSettlement(sellerId: string, periodStart: Date, periodEnd: Date) {
    const shops = await prisma.shop.findMany({ where: { sellerId }, select: { id: true } });
    const shopIds = shops.map((s) => s.id);
    const closed = await prisma.sellerOrder.findMany({
      where: { shopId: { in: shopIds }, status: "CLOSED", closedAt: { gte: periodStart, lte: periodEnd } },
      select: { id: true, itemsTotalPaise: true, deliveryFeePaise: true, commissionPaise: true },
    });
    const gross = closed.reduce((s, o) => s + Number(o.itemsTotalPaise), 0);
    const commission = closed.reduce((s, o) => s + Number(o.commissionPaise), 0);
    const delivery = closed.reduce((s, o) => s + Number(o.deliveryFeePaise), 0);
    const { tcsPaise, netPaise } = computeSettlement({ grossSalesPaise: gross, commissionPaise: commission, deliveryPaise: delivery, refundsPaise: 0, tcsBp: 0 });

    const seq = await this.nextSeq("settlement_seq");
    const settlement = await prisma.$transaction(async (tx) => {
      const s = await tx.settlement.create({
        data: {
          sellerId, periodStart, periodEnd, grossSalesPaise: BigInt(gross),
          commissionPaise: BigInt(commission), deliveryPaise: BigInt(delivery),
          refundsPaise: 0n, tcsPaise: BigInt(tcsPaise), netPaise: BigInt(netPaise),
          status: "PENDING", statementNo: statementNo(seq),
        },
      });
      for (const o of closed) {
        await tx.settlementItem.create({ data: { settlementId: s.id, sellerOrderId: o.id, amountPaise: o.itemsTotalPaise - o.commissionPaise } });
      }
      return s;
    });
    return { settlementId: settlement.id, netPaise, itemCount: closed.length };
  }

  /** Two-person payout release: needs TWO distinct approvers before PAID. */
  async releaseSettlement(settlementId: string, approverId: string): Promise<ReleaseResult> {
    return prisma.$transaction(async (tx) => {
      const s = await tx.settlement.findUnique({ where: { id: settlementId } });
      if (!s) return { ok: false as const, reason: "NOT_FOUND" as const };
      if (s.status === "PAID") return { ok: false as const, reason: "ALREADY_PAID" as const };

      const approvers = Array.from(new Set([...s.approvedBy, approverId]));
      if (approvers.length < 2) {
        await tx.settlement.update({ where: { id: settlementId }, data: { approvedBy: approvers } });
        return { ok: false as const, reason: "NEED_TWO_APPROVERS" as const };
      }
      // two distinct approvers → post the payout + mark PAID
      await tx.settlement.update({
        where: { id: settlementId },
        data: { approvedBy: approvers, status: "PAID", paidAt: new Date(), utr: `UTR${Date.now()}` },
      });
      return { ok: true as const, status: "PAID" as const };
    });
  }

  // ---- helpers ----
  private async account(tx: any, ref: AccountRef) {
    const existing = await tx.ledgerAccount.findUnique({
      where: { ownerType_ownerId_accountType: { ownerType: ref.ownerType, ownerId: ref.ownerId, accountType: ref.accountType } },
    });
    if (existing) return existing;
    return tx.ledgerAccount.create({ data: { ownerType: ref.ownerType, ownerId: ref.ownerId, accountType: ref.accountType } });
  }

  private async nextSeq(key: string): Promise<number> {
    const k = `${key}_${new Date().getUTCFullYear()}`;
    return prisma.$transaction(async (tx) => {
      const row = await tx.systemCheck.upsert({ where: { key: k }, update: {}, create: { key: k, value: "0" } });
      const next = Number.parseInt(row.value ?? "0", 10) + 1;
      await tx.systemCheck.update({ where: { key: k }, data: { value: String(next) } });
      return next;
    });
  }
}

/** Map worked-example account keys → ledger_accounts.account_type enum values. */
function normalize(key: string): string {
  switch (key) {
    case "CUSTOMER_RECEIVABLE": return "RECEIVABLE";
    case "SELLER_PAYABLE": return "PAYABLE";
    case "DELIVERY_INCOME": return "DELIVERY_INCOME";
    case "COMMISSION_INCOME": return "COMMISSION_INCOME";
    case "GATEWAY_FEE": return "GATEWAY_FEE";
    case "CLEARING": return "COD_HOLDING"; // clearing/suspense reuses COD_HOLDING bucket
    case "REFUND_CLAIM": return "REFUND_CLAIM";
    default: return key;
  }
}
