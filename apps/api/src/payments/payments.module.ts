import { Module } from "@nestjs/common";
import { PaymentsService, PAYMENT_PROVIDER } from "./payments.service";
import { MockPaymentProvider } from "./payment-provider.port";
import { PaymentsController } from "./payments.controller";
import { AuthModule } from "../auth/auth.module";

/**
 * M15 — Payments. Owns payments/payment_transactions/refunds/webhook_events.
 * DEV uses MockPaymentProvider; swap PAYMENT_PROVIDER for a Cashfree adapter
 * (same port) when sandbox keys exist (Tracking §7). Webhook = only capture authority.
 */
@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MockPaymentProvider,
    { provide: PAYMENT_PROVIDER, useClass: MockPaymentProvider },
  ],
  exports: [PaymentsService, PAYMENT_PROVIDER],
})
export class PaymentsModule {}
