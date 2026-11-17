import { Module } from "@nestjs/common";
import { InvoicingService } from "./invoicing.service";
import { AuthModule } from "../auth/auth.module";

/**
 * M31 — Invoicing. Owns invoices + credit_notes. GST tax invoice per child order
 * (per-seller sequential series), credit note per refund. e-invoice IRN hooks.
 */
@Module({
  imports: [AuthModule],
  providers: [InvoicingService],
  exports: [InvoicingService],
})
export class InvoicingModule {}
