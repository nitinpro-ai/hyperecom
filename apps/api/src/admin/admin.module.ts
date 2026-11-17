import { Module } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { SellersModule } from "../sellers/sellers.module";
import { FinanceModule } from "../finance/finance.module";
import { CatalogModule } from "../catalog/catalog.module";

/**
 * M24 — Admin Ops. Orchestrates privileged actions over other modules, each
 * wrapped in an audit_logs record (M26). Imports the modules whose services it
 * delegates to (cross-module via their exported ports — D-015).
 */
@Module({
  imports: [AuthModule, AuditModule, SellersModule, FinanceModule, CatalogModule],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
