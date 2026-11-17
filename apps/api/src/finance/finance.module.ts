import { Module } from "@nestjs/common";
import { FinanceService } from "./finance.service";
import { AuthModule } from "../auth/auth.module";

/**
 * M16 — Finance. Owns ledger_accounts, ledger_entries (append-only + balanced
 * by DB trigger), settlements, settlement_items, commissions. post() is the
 * only write path; consumes payment.captured.v1 / refund.* / delivery.delivered.v1.
 */
@Module({
  imports: [AuthModule],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
