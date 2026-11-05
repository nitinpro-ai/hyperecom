import { Module } from "@nestjs/common";
import { AuditService } from "./audit.service";

/**
 * M26 — Audit. Immutable record of every privileged action.
 * Public API: AuditService.record() — call INSIDE the same transaction as the
 * privileged mutation. Admin query endpoint lands with RBAC (M24).
 */
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
