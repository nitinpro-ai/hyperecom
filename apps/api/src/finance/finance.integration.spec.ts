import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { uniquePhone } from "../test-utils";
import { FinanceService } from "./finance.service";

/**
 * M16 integration (live DB): worked example posts a balanced transaction; the
 * DB trigger REJECTS an unbalanced posting + blocks UPDATE/DELETE (append-only);
 * two-person settlement release enforced.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-m16";

d("M16 finance (integration)", () => {
  const finance = new FinanceService();
  let sellerId = "", orderId = "";

  beforeAll(async () => {
    const u = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    const seller = await prisma.seller.create({ data: { userId: u.id, legalName: TAG, displayName: TAG, businessType: "INDIVIDUAL", pan: "ABCDE1234F", status: "APPROVED" } });
    sellerId = seller.id;
    orderId = (await prisma.$queryRaw<[{ gen_random_uuid: string }]>`SELECT gen_random_uuid()`)[0].gen_random_uuid;
  });

  afterAll(async () => {
    // ledger_entries are append-only (can't delete) — leave them; remove settlements + test seller
    await prisma.settlementItem.deleteMany({ where: { settlement: { sellerId } } });
    await prisma.settlement.deleteMany({ where: { sellerId } });
    await prisma.seller.deleteMany({ where: { id: sellerId } });
    await prisma.user.deleteMany({ where: { name: TAG } });
    await prisma.$disconnect();
  });

  it("worked example posts a BALANCED transaction (₹1000+₹50, 5%, 2%)", async () => {
    const p = await finance.postOrderCapture({
      sellerId, itemsTotalPaise: 100000, deliveryFeePaise: 5000,
      commissionRateBp: 500, gatewayFeeBp: 200, orderId,
    });
    expect(p.commissionPaise).toBe(5000);
    expect(p.sellerNetPaise).toBe(95000);
    // seller payable account balance = +₹950 (credit 1000 − debit 50 commission)
    const payable = await prisma.ledgerAccount.findFirstOrThrow({ where: { ownerType: "SELLER", ownerId: sellerId, accountType: "PAYABLE" } });
    expect(Number(payable.balancePaise)).toBe(95000);
  });

  it("DB trigger REJECTS an unbalanced posting", async () => {
    await expect(
      finance.post(
        [{ account: "X", debit: 1000, credit: 0, owner: { ownerType: "PLATFORM", ownerId: "00000000-0000-0000-0000-000000000000", accountType: "GATEWAY_FEE" } }],
        { type: "test", id: orderId },
      ),
    ).rejects.toThrow(/FINANCE_UNBALANCED/);
  });

  it("ledger_entries are append-only (UPDATE blocked by trigger)", async () => {
    const entry = await prisma.ledgerEntry.findFirstOrThrow({ where: { sourceId: orderId } });
    await expect(
      prisma.$executeRaw`UPDATE ledger_entries SET memo = 'tamper' WHERE id = ${entry.id}::uuid`,
    ).rejects.toThrow(/append-only/);
  });

  it("two-person settlement release: one approver is not enough, two distinct → PAID", async () => {
    const s = await prisma.settlement.create({ data: { sellerId, netPaise: 95000n, status: "PENDING", statementNo: `STMT-TEST-${Date.now()}` } });
    const A = "aaaaaaaa-0000-4000-8000-000000000001";
    const B = "bbbbbbbb-0000-4000-8000-000000000002";
    const first = await finance.releaseSettlement(s.id, A);
    expect(first).toEqual({ ok: false, reason: "NEED_TWO_APPROVERS" });
    // same approver again → still not enough
    const dup = await finance.releaseSettlement(s.id, A);
    expect(dup).toEqual({ ok: false, reason: "NEED_TWO_APPROVERS" });
    // a second distinct approver → released
    const second = await finance.releaseSettlement(s.id, B);
    expect(second).toEqual({ ok: true, status: "PAID" });
    const paid = await prisma.settlement.findUniqueOrThrow({ where: { id: s.id } });
    expect(paid.status).toBe("PAID");
    expect(paid.utr).toBeTruthy();
  });
});
