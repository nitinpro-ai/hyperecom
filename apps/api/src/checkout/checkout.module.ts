import { Module } from "@nestjs/common";
import { CheckoutService } from "./checkout.service";
import { CheckoutController } from "./checkout.controller";
import { AuthModule } from "../auth/auth.module";

/**
 * M13 — Checkout. No tables of its own; orchestrates the atomic place-order
 * across M12/M14/M09/M15/M20 in ONE transaction (D-015).
 */
@Module({
  imports: [AuthModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
