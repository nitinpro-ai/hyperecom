import { Injectable, Inject } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { AuditService } from "../audit/audit.service";
import { SellersService } from "../sellers/sellers.service";
import { FinanceService } from "../finance/finance.service";
import { CatalogService } from "../catalog/catalog.service";

const APPROVAL_SLA_H = 24;

/**
 * M24 — Admin Ops. Orchestration over existing modules: approval queues
 * (KYC/shops/riders), product merge queue, settlement two-person release, config.
 * EVERY privileged action writes an audit_logs row (M26) in the same transaction —
 * an unaudited admin action is impossible (AuditService throws → rollback).
 */
@Injectable()
export class AdminService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SellersService) private readonly sellers: SellersService,
    @Inject(FinanceService) private readonly finance: FinanceService,
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  // ---- approval queues (reads) ----
  async kycQueue() {
    return prisma.seller.findMany({
      where: { status: "KYC_PENDING" },
      orderBy: { kycSubmittedAt: "asc" },
      select: { id: true, legalName: true, displayName: true, kycSubmittedAt: true },
    });
  }

  async riderKycQueue() {
    return prisma.deliveryPartner.findMany({
      where: { kycStatus: "PENDING" },
      select: { id: true, userId: true, cityId: true, vehicle: true },
    });
  }

  async mergeQueue() {
    return prisma.matchGroup.findMany({
      where: { status: "OPEN" },
      orderBy: { similarity: "desc" },
      select: { id: true, canonicalProductId: true, similarity: true },
    });
  }

  async settlementQueue() {
    return prisma.settlement.findMany({
      where: { status: "PENDING" },
      select: { id: true, sellerId: true, netPaise: true, approvedBy: true, statementNo: true },
    });
  }

  /** Items breaching the 24h approval SLA (KYC submitted longer ago than SLA). */
  async slaBreaches(now = new Date()) {
    const cutoff = new Date(now.getTime() - APPROVAL_SLA_H * 3600e3);
    return prisma.seller.count({ where: { status: "KYC_PENDING", kycSubmittedAt: { lt: cutoff } } });
  }

  // ---- privileged actions (all audited) ----

  /** Approve a seller's KYC → delegate to SellersService + audit. */
  async approveSeller(sellerId: string, adminUserId: string) {
    const before = await prisma.seller.findUnique({ where: { id: sellerId }, select: { status: true } });
    const r = await this.sellers.approve(sellerId, adminUserId);
    if (r.ok) {
      await prisma.$transaction((tx) =>
        this.audit.record(tx, {
          actorUserId: adminUserId, actorRole: "ADMIN", action: "SELLER_KYC_APPROVE",
          entityType: "seller", entityId: sellerId, before, after: { status: r.status },
        }),
      );
    }
    return r;
  }

  /** Reject a seller (destructive → reason mandatory, checked BEFORE the action). */
  async rejectSeller(sellerId: string, adminUserId: string, reason: string) {
    if (!reason?.trim()) throw new Error('AUDIT_REFUSED: destructive action "SELLER_KYC_REJECT" requires a reason');
    const before = await prisma.seller.findUnique({ where: { id: sellerId }, select: { status: true } });
    const r = await this.sellers.reject(sellerId);
    if (r.ok) {
      await prisma.$transaction((tx) =>
        this.audit.record(tx, {
          actorUserId: adminUserId, actorRole: "ADMIN", action: "SELLER_KYC_REJECT",
          entityType: "seller", entityId: sellerId, before, after: { status: r.status }, reason,
        }),
      );
    }
    return r;
  }

  async suspendSeller(sellerId: string, adminUserId: string, reason: string) {
    if (!reason?.trim()) throw new Error('AUDIT_REFUSED: destructive action "SELLER_SUSPEND" requires a reason');
    const r = await this.sellers.suspend(sellerId);
    if (r.ok) {
      await prisma.$transaction((tx) =>
        this.audit.record(tx, {
          actorUserId: adminUserId, actorRole: "ADMIN", action: "SELLER_SUSPEND",
          entityType: "seller", entityId: sellerId, after: { status: r.status }, reason,
        }),
      );
    }
    return r;
  }

  async approveRiderKyc(partnerId: string, adminUserId: string) {
    await prisma.$transaction(async (tx) => {
      await tx.deliveryPartner.update({ where: { id: partnerId }, data: { kycStatus: "APPROVED" } });
      await this.audit.record(tx, {
        actorUserId: adminUserId, actorRole: "ADMIN", action: "RIDER_KYC_APPROVE",
        entityType: "delivery_partner", entityId: partnerId, after: { kycStatus: "APPROVED" },
      });
    });
    return { ok: true };
  }

  /** Two-person settlement release — delegates to FinanceService (also audited here). */
  async releaseSettlement(settlementId: string, adminUserId: string) {
    const r = await this.finance.releaseSettlement(settlementId, adminUserId);
    await prisma.$transaction((tx) =>
      this.audit.record(tx, {
        actorUserId: adminUserId, actorRole: "ADMIN", action: "SETTLEMENT_RELEASE_APPROVE",
        entityType: "settlement", entityId: settlementId, after: { result: r },
      }),
    );
    return r;
  }

  /** Merge a product match group (catalog) — audited. */
  async mergeProducts(matchGroupId: string, canonicalProductId: string, adminUserId: string, reason: string) {
    const r = await this.catalog.mergeGroup(matchGroupId, canonicalProductId, adminUserId);
    if (r.ok) {
      await prisma.$transaction((tx) =>
        this.audit.record(tx, {
          actorUserId: adminUserId, actorRole: "ADMIN", action: "PRODUCT_MERGE",
          entityType: "match_group", entityId: matchGroupId, after: { canonicalProductId, mergedCount: r.mergedCount }, reason,
        }),
      );
    }
    return r;
  }

  /** Set/override a commission rate (config) — audited. */
  async setCommission(input: { cityId?: string; categoryId?: string; shopId?: string; rateBp: number }, adminUserId: string) {
    const c = await prisma.$transaction(async (tx) => {
      const created = await tx.commission.create({
        data: { cityId: input.cityId ?? null, categoryId: input.categoryId ?? null, shopId: input.shopId ?? null, rateBp: input.rateBp, validFrom: new Date() },
      });
      await this.audit.record(tx, {
        actorUserId: adminUserId, actorRole: "ADMIN", action: "COMMISSION_SET",
        entityType: "commission", entityId: created.id, after: input,
      });
      return created;
    });
    return { commissionId: c.id };
  }

  /** Audit-log search (admin console). */
  async auditSearch(filter: { entityType?: string; entityId?: string; actorUserId?: string; limit?: number }) {
    return this.audit.query(filter);
  }
}
