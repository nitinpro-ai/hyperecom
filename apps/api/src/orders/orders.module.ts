import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { AuthModule } from "../auth/auth.module";

/**
 * M14 — Orders (OMS). Owns orders/seller_orders/order_items/order_events
 * (tenant: seller_orders). Validated state machines in orders.core; transitions
 * write events + release/consume stock + trigger refunds in one tx (D-015).
 */
@Module({
  imports: [AuthModule],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
