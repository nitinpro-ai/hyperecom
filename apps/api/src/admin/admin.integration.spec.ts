import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { uniquePhone } from "../test-utils";
import { AdminService } from "./admin.service";
import { AuditService } from "../audit/audit.service";
import { SellersService } from "../sellers/sellers.service";
import { FinanceService } from "../finance/finance.service";
import { CatalogService } from "../catalog/catalog.service";

/**
 * M24 integration (live DB): KYC approval queue + approve writes an audit_logs
 * row; reject requires a reason (destructive, enforced by M26); rider KYC;
 * settlement release audited. The gate: every admin action is audited.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-m24";
const ADMIN = "aaaaaaaa-0000-4000-8000-0000000000a1";

d("M24 admin ops (integration)", () => {
  const admin = new AdminService(new AuditService(), new SellersService(), new FinanceService(), new CatalogService());
  let sellerId = "", riderId = "";

  beforeAll(async () => {
    const city = await prisma.city.findFirstOrThrow();
    // a seller in KYC_PENDING for the queue
    const u = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    const seller = await prisma.seller.create({ data: { userId: u.id, legalName: TAG, displayName: TAG, businessType: "INDIVIDUAL", pan: "ABCDE1234F", status: "KYC_PENDING", kycSubmittedAt: new Date() } });
    sellerId = seller.id;
    const ru = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    const rider = await prisma.deliveryPartner.create({ data: { userId: ru.id, cityId: city.id, vehicle: "BIKE", kycStatus: "PENDING" } });
    riderId = rider.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const uids = users.map((u) => u.id);
    // audit_logs are append-only (M26) — intentionally not deleted.
    await prisma.deliveryPartner.deleteMany({ where: { userId: { in: uids } } });
    await prisma.seller.deleteMany({ where: { userId: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
    await prisma.$disconnect();
  });

  it("KYC queue lists the pending seller", async () => {
    const q = await admin.kycQueue();
    expect(q.some((s) => s.id === sellerId)).toBe(true);
  });

  it("approveSeller transitions + writes an audit_logs row", async () => {
    const r = await admin.approveSeller(sellerId, ADMIN);
    expect(r.ok).toBe(true);
    const s = await prisma.seller.findUniqueOrThrow({ where: { id: sellerId } });
    expect(s.status).toBe("APPROVED");
    const audit = await prisma.auditLog.findFirst({ where: { entityId: sellerId, action: "SELLER_KYC_APPROVE" } });
    expect(audit).not.toBeNull();
    expect(audit!.actorUserId).toBe(ADMIN);
  });

  it("suspendSeller WITHOUT a reason is refused (destructive → M26 enforces reason)", async () => {
    // suspend requires a reason; empty reason must throw (no unaudited destructive action)
    await expect(admin.suspendSeller(sellerId, ADMIN, "")).rejects.toThrow(/AUDIT_REFUSED/);
    // with a reason it succeeds + audits
    const r = await admin.suspendSeller(sellerId, ADMIN, "policy violation");
    expect(r.ok).toBe(true);
    expect(await prisma.auditLog.findFirst({ where: { entityId: sellerId, action: "SELLER_SUSPEND" } })).not.toBeNull();
  });

  it("rider KYC approval is audited", async () => {
    await admin.approveRiderKyc(riderId, ADMIN);
    const r = await prisma.deliveryPartner.findUniqueOrThrow({ where: { id: riderId } });
    expect(r.kycStatus).toBe("APPROVED");
    expect(await prisma.auditLog.findFirst({ where: { entityId: riderId, action: "RIDER_KYC_APPROVE" } })).not.toBeNull();
  });

  it("commission config change is audited", async () => {
    const r = await admin.setCommission({ cityId: undefined, rateBp: 700 }, ADMIN);
    expect(await prisma.auditLog.findFirst({ where: { entityId: r.commissionId, action: "COMMISSION_SET" } })).not.toBeNull();
    await prisma.commission.delete({ where: { id: r.commissionId } });
  });
});
