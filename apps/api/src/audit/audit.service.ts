import { Injectable } from "@nestjs/common";
import type { Prisma } from "@apnacity/db";
import { prisma } from "@apnacity/db";

export type AuditTx = Prisma.TransactionClient;

export interface AuditEntry {
  actorUserId?: string;
  actorRole?: string;
  action: string;            // e.g. SELLER_ORDER_CANCEL, KYC_APPROVE
  entityType: string;
  entityId: string;
  shopId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  reason?: string;
}

export interface AuditQuery {
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  shopId?: string;
  /** keyset cursor: only rows with createdAt/older-than-or-equal AFTER this id */
  after?: string;
  limit?: number;
}

/** Destructive operations MUST carry a reason (spec 08 §2, M26 rules). */
const DESTRUCTIVE = /CANCEL|DELETE|SUSPEND|REJECT|REFUND|RELEASE|BLOCK/i;

@Injectable()
export class AuditService {
  /**
   * Record a privileged action INSIDE the caller's transaction.
   * Throws when a destructive action has no reason — the whole transaction
   * rolls back, so an unaudited destructive change is impossible.
   */
  async record(tx: AuditTx, entry: AuditEntry): Promise<void> {
    if (DESTRUCTIVE.test(entry.action) && !entry.reason?.trim()) {
      throw new Error(
        `AUDIT_REFUSED: destructive action "${entry.action}" requires a reason`
      );
    }
    await tx.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        actorRole: entry.actorRole ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        shopId: entry.shopId ?? null,
        before: (entry.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (entry.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        reason: entry.reason ?? null,
      },
    });
  }

  /** Keyset query (admin console lands with M24 RBAC). */
  async query(q: AuditQuery) {
    const limit = Math.min(q.limit ?? 50, 200);
    return prisma.auditLog.findMany({
      where: {
        entityType: q.entityType,
        entityId: q.entityId,
        actorUserId: q.actorUserId,
        shopId: q.shopId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
      ...(q.after ? { cursor: { id: q.after } as const, skip: 1 } : {}),
    });
  }
}
